#!/usr/bin/env python3
"""Build Rail-WAYS Layer 1 from the Neo2308 Indian Railways GTFS feed.

The upstream feed is downloaded at build time. Rail-WAYS publishes a normalized,
search-optimized snapshot to GitHub Pages; it does not call the upstream source
from the browser.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
import re
import shutil
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "generated_data"
GTFS_URL = os.environ.get(
    "NEO_GTFS_URL",
    "https://github.com/Neo2308/indianrailways-gtfs/raw/refs/heads/main/gtfs/gtfs.zip",
)
SOURCE_REPO = "https://github.com/Neo2308/indianrailways-gtfs"
SOURCE_FILE = "https://github.com/Neo2308/indianrailways-gtfs/blob/main/gtfs/gtfs.zip"


def read_csv(zf: zipfile.ZipFile, name: str, required=False):
    try:
        raw = zf.read(name)
    except KeyError:
        if required:
            raise RuntimeError(f"GTFS feed is missing required file: {name}")
        return []
    text = raw.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def first(row, *keys):
    for key in keys:
        value = (row.get(key) or "").strip()
        if value:
            return value
    return ""


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def integer(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def time_minutes(value):
    if not value:
        return None
    parts = value.split(":")
    if len(parts) < 2:
        return None
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return None


def display_time(value):
    if not value:
        return None
    parts = value.split(":")
    if len(parts) >= 2:
        hour = int(parts[0]) % 24
        return f"{hour:02d}:{int(parts[1]):02d}"
    return value


def day_from_time(value, base_minutes=None):
    minutes = time_minutes(value)
    if minutes is None:
        return 1
    # GTFS permits times greater than 24:00:00 to represent arrival/departure
    # on the following service day.
    return max(1, minutes // (24 * 60) + 1)


def haversine(a_lat, a_lon, b_lat, b_lon):
    if None in (a_lat, a_lon, b_lat, b_lon):
        return 0.0
    r = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def duration_text(start, end):
    a, b = time_minutes(start), time_minutes(end)
    if a is None or b is None:
        return None, None
    delta = b - a
    while delta < 0:
        delta += 24 * 60
    days, rem = divmod(delta, 24 * 60)
    hours, mins = divmod(rem, 60)
    total_hours = delta / 60
    if days:
        text = f"{days}d {hours}h {mins}m" if mins else f"{days}d {hours}h"
    elif hours:
        text = f"{hours}h {mins}m" if mins else f"{hours}h"
    else:
        text = f"{mins}m"
    return text, total_hours


def running_days(calendar_by_service):
    labels = [
        ("monday", "Mon"), ("tuesday", "Tue"), ("wednesday", "Wed"),
        ("thursday", "Thu"), ("friday", "Fri"), ("saturday", "Sat"),
        ("sunday", "Sun"),
    ]
    out = []
    for key, label in labels:
        if str(calendar_by_service.get(key, "0")) == "1":
            out.append(label)
    return out


def station_code(row):
    return first(row, "stop_code", "station_code", "stop_id").upper()


def train_number(route, trip):
    raw = first(route, "route_short_name", "route_id") or first(trip, "trip_short_name", "trip_id")
    # Preserve leading zeroes if a source intentionally uses them, but normalize whitespace.
    return raw.strip()


def main():
    OUT.mkdir(exist_ok=True)
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    chunks = OUT / "schedule_chunks"
    chunks.mkdir()

    print(f"Downloading Neo2308 GTFS: {GTFS_URL}")
    req = urllib.request.Request(GTFS_URL, headers={"User-Agent": "Rail-WAYS/1.0"})
    with urllib.request.urlopen(req, timeout=120) as response:
        payload = response.read()
    print(f"Downloaded {len(payload):,} bytes")
    sha = hashlib.sha256(payload).hexdigest()

    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        names = set(zf.namelist())
        stops = read_csv(zf, "stops.txt", required=True)
        routes = read_csv(zf, "routes.txt", required=True)
        trips = read_csv(zf, "trips.txt", required=True)
        stop_times = read_csv(zf, "stop_times.txt", required=True)
        calendars = read_csv(zf, "calendar.txt")
        calendar_dates = read_csv(zf, "calendar_dates.txt")
        feed_info = read_csv(zf, "feed_info.txt")

    # Station normalization.
    station_map = {}
    for s in stops:
        code = station_code(s)
        if not code:
            continue
        lat = num(first(s, "stop_lat"))
        lon = num(first(s, "stop_lon"))
        station_map.setdefault(code, {
            "code": code,
            "name": first(s, "stop_name") or code,
            "city": first(s, "municipality", "city") or None,
            "state": first(s, "region", "state") or None,
            "zone": None,
            "address": None,
            "latitude": lat,
            "longitude": lon,
        })

    # A stop_id may be used in stop_times while stop_code is the user-facing code.
    stop_id_to_code = {}
    for s in stops:
        sid = first(s, "stop_id")
        code = station_code(s)
        if sid and code:
            stop_id_to_code[sid] = code

    route_by_id = {first(r, "route_id"): r for r in routes if first(r, "route_id")}
    calendar_by_service = {first(c, "service_id"): c for c in calendars if first(c, "service_id")}
    exceptions_by_service = defaultdict(list)
    for row in calendar_dates:
        sid = first(row, "service_id")
        if sid:
            exceptions_by_service[sid].append(row)

    # Group stop times by trip.
    times_by_trip = defaultdict(list)
    for row in stop_times:
        tid = first(row, "trip_id")
        if tid:
            times_by_trip[tid].append(row)
    for rows in times_by_trip.values():
        rows.sort(key=lambda r: integer(first(r, "stop_sequence")) or 0)

    # Some feeds have multiple trip/service variants for a train. Preserve them as
    # schedule variants instead of silently throwing them away.
    variants_by_train = defaultdict(list)
    for trip in trips:
        tid = first(trip, "trip_id")
        rows = times_by_trip.get(tid, [])
        if not rows:
            continue
        route = route_by_id.get(first(trip, "route_id"), {})
        number = train_number(route, trip)
        if not number:
            continue
        service_id = first(trip, "service_id")
        first_row, last_row = rows[0], rows[-1]
        first_code = stop_id_to_code.get(first(first_row, "stop_id"), first(first_row, "stop_code").upper())
        last_code = stop_id_to_code.get(first(last_row, "stop_id"), first(last_row, "stop_code").upper())
        base_minutes = time_minutes(first(first_row, "departure_time", "arrival_time"))
        schedule = []
        cumulative_distance = 0.0
        previous = None
        for idx, row in enumerate(rows, start=1):
            sid = first(row, "stop_id")
            code = stop_id_to_code.get(sid, first(row, "stop_code").upper())
            st = station_map.get(code, {"code": code, "name": first(row, "stop_name") or code})
            arr = first(row, "arrival_time") or None
            dep = first(row, "departure_time") or None
            halt = None
            am, dm = time_minutes(arr), time_minutes(dep)
            if am is not None and dm is not None:
                halt = max(0, dm - am)
            if previous:
                cumulative_distance += haversine(previous[0], previous[1], st.get("latitude"), st.get("longitude"))
            previous = (st.get("latitude"), st.get("longitude"))
            explicit_dist = num(first(row, "shape_dist_traveled", "distance_traveled"))
            schedule.append({
                "seq": idx,
                "code": code,
                "name": st.get("name") or code,
                "day": day_from_time(arr or dep, base_minutes),
                "arr": display_time(arr),
                "dep": display_time(dep),
                "halt": halt,
                "distance": round(explicit_dist, 1) if explicit_dist is not None else None,
            })

        duration, duration_hours = duration_text(
            first(first_row, "departure_time", "arrival_time"),
            first(last_row, "arrival_time", "departure_time"),
        )
        cal = calendar_by_service.get(service_id, {})
        runs = running_days(cal)
        variant = {
            "tripId": tid,
            "serviceId": service_id or None,
            "runsDays": runs or None,
            "source": first_code,
            "destination": last_code,
            "departure": schedule[0].get("dep") or schedule[0].get("arr"),
            "arrival": schedule[-1].get("arr") or schedule[-1].get("dep"),
            "duration": duration,
            "durationHours": duration_hours,
            "distance": schedule[-1].get("distance"),
            "rows": schedule,
        }
        variants_by_train[number].append(variant)

    trains = []
    station_trains = defaultdict(set)
    schedule_index = {}
    chunk_data = defaultdict(dict)

    for number, variants in sorted(variants_by_train.items(), key=lambda kv: kv[0]):
        # Deduplicate identical timetable variants while retaining their run days.
        unique = {}
        for v in variants:
            signature = json.dumps(v["rows"], sort_keys=True, separators=(",", ":"))
            if signature not in unique:
                unique[signature] = v
            else:
                old = unique[signature]
                old_days = set(old.get("runsDays") or [])
                old_days.update(v.get("runsDays") or [])
                old["runsDays"] = [d for d in ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] if d in old_days] or None
        variants = list(unique.values())
        variants.sort(key=lambda v: (v.get("departure") or "99:99", v.get("tripId") or ""))
        primary = variants[0]
        route = next((r for r in routes if train_number(r, {}) == number), {})
        name = first(route, "route_long_name", "route_short_name") or number
        desc = first(route, "route_desc") or None
        rtype = desc or first(route, "route_type") or "Train"
        classes = []
        for text in [name, desc or ""]:
            for c in re.findall(r"\b(?:1A|2A|3A|3E|SL|CC|EC|2S|FC|EA|EV|AC)\b", text.upper()):
                if c not in classes:
                    classes.append(c)
        t = {
            "number": number,
            "name": name,
            "type": rtype,
            "from": primary["source"],
            "to": primary["destination"],
            "fromName": station_map.get(primary["source"], {}).get("name", primary["source"]),
            "toName": station_map.get(primary["destination"], {}).get("name", primary["destination"]),
            "departure": primary["departure"],
            "arrival": primary["arrival"],
            "duration": primary["duration"],
            "durationHours": primary["durationHours"],
            "distance": primary["distance"],
            "stopsCount": max(0, len(primary["rows"]) - 2),
            "runsDays": primary["runsDays"],
            "classes": classes,
            "variantCount": len(variants),
        }
        trains.append(t)
        for v in variants:
            codes = []
            for row in v["rows"]:
                code = row["code"]
                if code not in codes:
                    codes.append(code)
                    station_trains[code].add(number)
        bucket = re.sub(r"[^0-9A-Za-z]", "_", number)[:2] or "xx"
        schedule_index[number] = bucket
        chunk_data[bucket][number] = variants

    # Write stations, trains, and indexes.
    def write_json(path, obj):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    station_list = sorted(station_map.values(), key=lambda s: (s["name"].lower(), s["code"]))
    train_list = trains
    station_trains_out = {k: sorted(v) for k, v in sorted(station_trains.items())}

    write_json(OUT / "stations.json", station_list)
    write_json(OUT / "trains.json", train_list)
    write_json(OUT / "station_trains.json", station_trains_out)
    write_json(OUT / "schedule_index.json", schedule_index)
    for bucket, data in chunk_data.items():
        write_json(chunks / f"{bucket}.json", data)

    feed_version = None
    if feed_info:
        fi = feed_info[0]
        feed_version = first(fi, "feed_version", "feed_start_date") or None
    meta = {
        "source": "Neo2308 / indianrailways-gtfs",
        "sourceUrl": SOURCE_REPO,
        "sourceFile": SOURCE_FILE,
        "licenseNote": "The upstream repository is public, but Rail-WAYS should retain attribution and verify the upstream data license/redistribution terms before treating this as a legally independent dataset.",
        "feedVersion": feed_version,
        "upstreamSha256": sha,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "trainCount": len(train_list),
        "stationCount": len(station_list),
        "scheduleTrainCount": len(schedule_index),
        "scheduleVariantCount": sum(len(v) for v in chunk_data.values()),
        "stationTrainIndexCount": sum(len(v) for v in station_trains_out.values()),
        "upstreamFiles": sorted(names),
        "limitations": [
            "This is a static timetable snapshot, not live operational status.",
            "The displayed counts describe the upstream GTFS feed available at build time, not a claim of official Indian Railways completeness.",
            "Distance is shown only when supplied by the GTFS feed; Rail-WAYS does not present straight-line estimates as railway distance.",
            "Train classes are shown only when inferable from the feed text.",
        ],
    }
    write_json(OUT / "meta.json", meta)

    # Basic integrity checks; fail the build rather than publishing an empty/partial site.
    if not os.environ.get("ALLOW_SMALL_FEED"):
        if len(station_list) < 1000:
            raise RuntimeError(f"Station count unexpectedly low: {len(station_list)}")
        if len(train_list) < 1000:
            raise RuntimeError(f"Train count unexpectedly low: {len(train_list)}")
    if len(schedule_index) != len(train_list):
        raise RuntimeError("Every published train must have a schedule index entry")
    if "HTZ" not in station_trains_out:
        print("WARNING: HTZ is not present in this upstream snapshot")
    print(json.dumps({k: meta[k] for k in ["trainCount","stationCount","scheduleTrainCount","scheduleVariantCount"]}, indent=2))


if __name__ == "__main__":
    main()
