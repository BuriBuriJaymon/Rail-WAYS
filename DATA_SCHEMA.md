# Rail-WAYS Data Foundation v0.2

## Entities

### Stations
- `code`
- `name`
- `city`
- `state`
- `zone`
- `address`
- `latitude`
- `longitude`

### Trains
- `number`
- `name`
- `type`
- `from`
- `to`
- `fromName`
- `toName`
- `departure`
- `arrival`
- `duration`
- `distance`
- `zone`
- `stopsCount`

### Train stops / schedules
- `train_number`
- `train_name`
- `station_code`
- `station_name`
- `day`
- `arrival`
- `departure`

## Intentionally excluded

Coach count and coach composition are not part of the Rail-WAYS v0.2 data model.

## Source strategy

The prototype uses the public DataMeet Indian Railways dataset as a historical/reference snapshot and keeps the source URLs in `js/data.js`. The current official Government Open Data Platform also publishes railway station and timetable catalogs, but those catalogs are historical (the timetable catalog shows an update date of 24 January 2018). A future ingestion pipeline should therefore distinguish historical reference data from current timetable data.

The full schedule file is loaded only when timetable detail is requested because it is substantially larger than the station/train files.
