# Rail-WAYS Layer 1 data pipeline

Rail-WAYS Layer 1 is built from the **Neo2308 Indian Railways GTFS feed**.

Source repository:
https://github.com/Neo2308/indianrailways-gtfs

Upstream GTFS file:
https://github.com/Neo2308/indianrailways-gtfs/blob/main/gtfs/gtfs.zip

## What happens during deployment

1. GitHub Actions downloads the upstream GTFS ZIP at build time.
2. `scripts/build_data.py` parses the standard GTFS files.
3. Rail-WAYS creates browser-optimized JSON files under `generated_data/`.
4. The generated database is copied into the GitHub Pages artifact.
5. The browser searches the generated snapshot locally; it does **not** call Neo2308 or another API for normal Layer 1 searches.
6. The scheduled workflow rebuilds the snapshot daily and can also be started manually.

## Generated database

- `stations.json` — station directory and metadata.
- `trains.json` — normalized train/service records.
- `station_trains.json` — station → train index used for fast origin/destination searches.
- `schedule_index.json` — train → lazy schedule chunk index.
- `schedule_chunks/*.json` — complete stop-by-stop timetable variants.
- `meta.json` — source, build time, feed hash, counts and limitations.

## Layer 1 search semantics

For `FROM → TO`, Rail-WAYS intersects the trains serving both stations and then verifies the stop sequence. A train is returned only when the origin occurs before the destination in its timetable.

The station search accepts station codes and name/city/state text. The database is the only source used for Layer 1 results.

## Important data boundary

This is a **static timetable snapshot**. It is not live train location, live delay, seat availability, PNR or booking data.

The counts displayed by Rail-WAYS describe the upstream GTFS snapshot available when the build ran. They are not a claim that the dataset is an official Indian Railways master database.

The upstream repository is public, but its exact data redistribution terms should be retained/verified before commercial redistribution. Rail-WAYS includes source attribution and does not claim affiliation with Indian Railways, CRIS, NTES or IRCTC.
