/*
  Rail-WAYS v0.2 data configuration.

  The browser loads the open railway snapshot on demand instead of copying a
  very large dataset into the GitHub Pages repository. This keeps the frontend
  lightweight while preserving a clear path to a database/API later.

  Source snapshot: DataMeet / Indian Railways Data
  https://github.com/datameet/railways

  The snapshot is historical/reference data, not a live timetable.
*/

const DATA_SOURCES = {
  stations: "https://raw.githubusercontent.com/datameet/railways/master/stations.json",
  trains: "https://raw.githubusercontent.com/datameet/railways/master/trains.json",
  schedules: "https://raw.githubusercontent.com/datameet/railways/master/schedules.json"
};

const SOURCE_INFO = {
  name: "DataMeet — Indian Railways Data",
  url: "https://github.com/datameet/railways",
  type: "Open community dataset",
  status: "Historical/reference snapshot",
  note: "Not an official live operational feed. Verify current schedules before relying on journey information."
};

// Small fallback dataset so the site remains usable if a remote source is unavailable.
const fallbackStations = [
  {code:"NDLS", name:"New Delhi", city:"New Delhi", state:"Delhi", zone:"NR"},
  {code:"CNB", name:"Kanpur Central", city:"Kanpur", state:"Uttar Pradesh", zone:"NR"},
  {code:"PRYJ", name:"Prayagraj Jn", city:"Prayagraj", state:"Uttar Pradesh", zone:"NCR"},
  {code:"DDU", name:"Pt. Deen Dayal Upadhyaya Jn", city:"Chandauli", state:"Uttar Pradesh", zone:"ECR"},
  {code:"GAYA", name:"Gaya Jn", city:"Gaya", state:"Bihar", zone:"ECR"},
  {code:"PNBE", name:"Patna Jn", city:"Patna", state:"Bihar", zone:"ECR"},
  {code:"HWH", name:"Howrah Jn", city:"Howrah", state:"West Bengal", zone:"ER"},
  {code:"BPL", name:"Bhopal Jn", city:"Bhopal", state:"Madhya Pradesh", zone:"WCR"},
  {code:"LKO", name:"Lucknow", city:"Lucknow", state:"Uttar Pradesh", zone:"NR"},
  {code:"AGC", name:"Agra Cantt", city:"Agra", state:"Uttar Pradesh", zone:"NCR"}
];

const fallbackTrains = [
  {number:"12001", name:"Bhopal Shatabdi", type:"Shatabdi", from:"NDLS", to:"BPL", departure:"06:00", arrival:"14:00", duration:"8h 00m", distance:707, stopsCount:3},
  {number:"12002", name:"New Delhi - Lucknow Shatabdi", type:"Shatabdi", from:"NDLS", to:"LKO", departure:"06:10", arrival:"12:25", duration:"6h 15m", distance:null, stopsCount:3},
  {number:"12301", name:"Howrah - New Delhi Rajdhani", type:"Rajdhani", from:"HWH", to:"NDLS", departure:"16:55", arrival:"10:00", duration:"17h 05m", distance:null, stopsCount:4},
  {number:"22436", name:"New Delhi - Varanasi Vande Bharat", type:"Vande Bharat", from:"NDLS", to:"DDU", departure:"06:00", arrival:"14:00", duration:"8h 00m", distance:null, stopsCount:4},
  {number:"12310", name:"New Delhi - Rajendra Nagar Rajdhani", type:"Rajdhani", from:"NDLS", to:"PNBE", departure:"17:15", arrival:"05:30", duration:"12h 15m", distance:null, stopsCount:4},
  {number:"12506", name:"North East Express", type:"Superfast", from:"NDLS", to:"GAYA", departure:"06:45", arrival:"20:10", duration:"13h 25m", distance:null, stopsCount:4},
  {number:"12424", name:"New Delhi - Dibrugarh Rajdhani", type:"Rajdhani", from:"NDLS", to:"PNBE", departure:"16:10", arrival:"04:40", duration:"12h 30m", distance:null, stopsCount:4},
  {number:"12280", name:"Taj Express", type:"Express", from:"NDLS", to:"AGC", departure:"07:05", arrival:"10:20", duration:"3h 15m", distance:null, stopsCount:2}
];

let stations = fallbackStations;
let trains = fallbackTrains;
let schedules = null;
let dataMode = "fallback";
let scheduleLoading = false;
