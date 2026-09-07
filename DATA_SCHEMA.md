# Rail-WAYS Layer 1 data schema

## Station

```text
code
name
city
state
zone
address
latitude
longitude
```

## Train

```text
number
name
type
from
fromName
to
toName
departure
arrival
duration
durationHours
distance
zone
returnTrain
classes
runsDays
stopsCount
```

`runsDays` is intentionally nullable because the selected CC0 DataMeet source does not provide a reliable weekly running-days field.

## Schedule row

```text
seq
code
name
day
arr
dep
halt
distance
```

The DataMeet schedule source supplies arrival/departure/day/station information. `halt` and per-stop distance remain null when the source does not supply them.
