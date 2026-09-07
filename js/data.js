const DATA_ROOT = "generated_data";
const SOURCE_INFO = {
  name: "Neo2308 — Indian Railways GTFS",
  url: "https://github.com/Neo2308/indianrailways-gtfs",
  note: "Rail-WAYS displays the static timetable snapshot produced from the upstream GTFS feed at build time. It is not live operational data and Rail-WAYS is not affiliated with Indian Railways, CRIS, NTES or IRCTC."
};

let stations = [];
let trains = [];
let stationByCode = {};
let stationTrains = {};
let scheduleIndex = {};
const scheduleCache = new Map();
let dataMode = "loading";
let dataMeta = null;
