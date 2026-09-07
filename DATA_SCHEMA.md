Rail-WAYS Layer 1 data schema
Station
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
Train
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
`runsDays` contains weekly running days when represented by the Neo2308 GTFS calendar. It remains nullable when the upstream feed does not provide a usable service calendar.
Schedule row
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
The Neo2308 GTFS stop_times feed supplies arrival/departure/station sequence. Rail-WAYS derives service day offsets from GTFS times and uses source distance when present; otherwise it may estimate cumulative geographic distance from station coordinates.
