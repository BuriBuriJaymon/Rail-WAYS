import json
import re
import shutil
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.source_cache'
OUT = ROOT / 'generated_data'
RAW.mkdir(exist_ok=True)

BASE = 'https://raw.githubusercontent.com/datameet/railways/master'
FILES = {
    'stations.json': f'{BASE}/stations.json',
    'trains.json': f'{BASE}/trains.json',
    'schedules.json': f'{BASE}/schedules.json',
}


def download(name, url):
    path = RAW / name
    print(f'Downloading {name} …')
    req = urllib.request.Request(url, headers={'User-Agent': 'Rail-WAYS-data-build/1.0'})
    with urllib.request.urlopen(req, timeout=180) as r, path.open('wb') as f:
        shutil.copyfileobj(r, f, length=1024 * 1024)
    print(f'  {path.stat().st_size / (1024*1024):.1f} MiB')
    return path


def clean(v):
    if v is None:
        return ''
    return str(v).strip()


def num(v):
    try:
        if v in (None, '', 'None'):
            return None
        x = float(v)
        return int(x) if x.is_integer() else x
    except Exception:
        return None


def duration(h, m):
    h, m = num(h), num(m)
    if h is None and m is None:
        return ''
    h = int(h or 0)
    m = int(m or 0)
    return f'{h}h {m}m' if m else f'{h}h'


def main():
    for name, url in FILES.items():
        download(name, url)

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'schedule_chunks').mkdir(parents=True)

    # Stations: keep the full useful station metadata from DataMeet.
    station_raw = json.loads((RAW / 'stations.json').read_text(encoding='utf-8'))
    stations = []
    for feature in station_raw.get('features', []):
        p = feature.get('properties') or {}
        coords = (feature.get('geometry') or {}).get('coordinates') or []
        code = clean(p.get('code'))
        name = clean(p.get('name'))
        if not code or not name:
            continue
        stations.append({
            'code': code,
            'name': name,
            'city': clean(p.get('city')),
            'state': clean(p.get('state')),
            'zone': clean(p.get('zone')),
            'address': clean(p.get('address')),
            'latitude': coords[1] if len(coords) > 1 else None,
            'longitude': coords[0] if coords else None,
        })
    stations.sort(key=lambda x: x['code'])
    station_map = {s['code']: s for s in stations}
    (OUT / 'stations.json').write_text(json.dumps(stations, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # Trains: DataMeet provides train-level metadata. It does not provide a
    # weekly run-days field, so we explicitly leave that field unavailable.
    train_raw = json.loads((RAW / 'trains.json').read_text(encoding='utf-8'))
    trains = []
    for feature in train_raw.get('features', []):
        p = feature.get('properties') or {}
        number = clean(p.get('number') or p.get('train_number'))
        if not number:
            continue
        classes = []
        class_map = {
            'first_ac': '1A', 'second_ac': '2A', 'third_ac': '3A',
            'sleeper': 'SL', 'chair_car': 'CC', 'second_sitting': '2S',
            'first_class': 'FC', 'executive_chair_car': 'EC'
        }
        for key, label in class_map.items():
            if p.get(key) is True:
                classes.append(label)
        trains.append({
            'number': number,
            'name': clean(p.get('name') or p.get('train_name')),
            'type': clean(p.get('type')) or 'Train',
            'from': clean(p.get('from_station_code')),
            'fromName': clean(p.get('from_station_name')),
            'to': clean(p.get('to_station_code')),
            'toName': clean(p.get('to_station_name')),
            'departure': clean(p.get('departure')),
            'arrival': clean(p.get('arrival')),
            'duration': duration(p.get('duration_h'), p.get('duration_m')),
            'durationHours': (num(p.get('duration_h')) or 0) + (num(p.get('duration_m')) or 0) / 60,
            'distance': num(p.get('distance')),
            'zone': clean(p.get('zone')),
            'returnTrain': clean(p.get('return_train')),
            'classes': classes,
            'runsDays': None,
            'stopsCount': None,
        })
    # Deduplicate by train number, preferring the first complete record.
    dedup = {}
    for t in trains:
        dedup.setdefault(t['number'], t)
    trains = list(dedup.values())
    trains.sort(key=lambda x: (int(x['number']) if x['number'].isdigit() else 10**9, x['number']))
    train_map = {t['number']: t for t in trains}

    # Schedules: normalize and chunk by train-number prefix for lazy browser loading.
    station_trains = defaultdict(set)
    chunks = defaultdict(dict)
    schedule_count = 0
    with (RAW / 'schedules.json').open(encoding='utf-8') as f:
        schedule_raw = json.load(f)
    for obj in schedule_raw:
        no = clean(obj.get('train_number'))
        if not no or no not in train_map:
            continue
        code = clean(obj.get('station_code'))
        if not code:
            continue
        name = clean(obj.get('station_name')) or station_map.get(code, {}).get('name', '')
        row = {
            'seq': schedule_count,  # replaced below after grouping
            'code': code,
            'name': name,
            'day': num(obj.get('day')),
            'arr': clean(obj.get('arrival')),
            'dep': clean(obj.get('departure')),
            'halt': None,
            'distance': None,
        }
        chunks[re.sub(r'\D', '', no).zfill(5)[:2]][set([no]).pop() if False else no] = chunks[re.sub(r'\D', '', no).zfill(5)[:2]].get(no, []) + [row]
        station_trains[code].add(no)
        schedule_count += 1

    # Fix sequence, stop count, and useful distance data where present in source.
    schedule_index = {}
    for bucket, records in chunks.items():
        for no, rows in records.items():
            for i, row in enumerate(rows, 1):
                row['seq'] = i
            train_map[no]['stopsCount'] = len(rows)
            schedule_index[no] = bucket
        (OUT / 'schedule_chunks' / f'{bucket}.json').write_text(
            json.dumps(records, ensure_ascii=False, separators=(',', ':')), encoding='utf-8'
        )

    # Remove null-only keys from the public train payload where appropriate.
    for t in trains:
        if t['stopsCount'] is None:
            t['stopsCount'] = 0

    (OUT / 'trains.json').write_text(json.dumps(trains, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (OUT / 'station_trains.json').write_text(
        json.dumps({k: sorted(v) for k, v in sorted(station_trains.items())}, separators=(',', ':')), encoding='utf-8'
    )
    (OUT / 'schedule_index.json').write_text(json.dumps(schedule_index, separators=(',', ':')), encoding='utf-8')

    meta = {
        'source': 'DataMeet / datameet/railways',
        'sourceUrl': 'https://github.com/datameet/railways',
        'license': 'CC0 (as stated in the repository README)',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'trainCount': len(trains),
        'stationCount': len(stations),
        'scheduleTrainCount': len(schedule_index),
        'scheduleRowCount': schedule_count,
        'dataCharacter': 'Historical/community reference snapshot; not a live operational feed.',
        'limitations': [
            'The DataMeet source does not provide a reliable weekly running-days field.',
            'Timetables may not reflect current 2026 operational changes.',
            'Rail-WAYS is not affiliated with Indian Railways, CRIS, NTES or IRCTC.'
        ]
    }
    (OUT / 'meta.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    print(json.dumps(meta, indent=2))


if __name__ == '__main__':
    main()
