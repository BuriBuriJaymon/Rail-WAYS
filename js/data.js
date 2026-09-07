const DATA_ROOT = "generated_data";
const SOURCE_INFO = {
  name: "DataMeet — Indian Railways community dataset",
  url: "https://github.com/datameet/railways",
  license: "CC0 (stated by the repository README)",
  note: "Historical/reference timetable data. It is not a live operational feed and Rail-WAYS is not affiliated with Indian Railways, CRIS, NTES or IRCTC."
};

const fallbackStations = [
  {code:"NDLS",name:"New Delhi",city:"New Delhi",state:"Delhi",zone:"NR"},
  {code:"CNB",name:"Kanpur Central",city:"Kanpur",state:"Uttar Pradesh",zone:"NR"},
  {code:"PRYJ",name:"Prayagraj Jn",city:"Prayagraj",state:"Uttar Pradesh",zone:"NCR"},
  {code:"DDU",name:"Pt. Deen Dayal Upadhyaya Jn",city:"Chandauli",state:"Uttar Pradesh",zone:"ECR"},
  {code:"GAYA",name:"Gaya Jn",city:"Gaya",state:"Bihar",zone:"ECR"},
  {code:"PNBE",name:"Patna Jn",city:"Patna",state:"Bihar",zone:"ECR"},
  {code:"KOTA",name:"Kota Jn",city:"Kota",state:"Rajasthan",zone:"WCR"}
];
const fallbackTrains = [
  {number:"12310",name:"New Delhi - Rajendra Nagar Rajdhani",type:"Rajdhani",from:"NDLS",to:"PNBE",fromName:"New Delhi",toName:"Patna Jn",departure:"17:15",arrival:"05:30",duration:"12h 15m",distance:null,stopsCount:0,runsDays:null},
  {number:"12506",name:"North East Express",type:"Superfast",from:"NDLS",to:"GAYA",fromName:"New Delhi",toName:"Gaya Jn",departure:"06:45",arrival:"20:10",duration:"13h 25m",distance:null,stopsCount:0,runsDays:null}
];
let stations = fallbackStations;
let trains = fallbackTrains;
let stationByCode = Object.fromEntries(stations.map(s=>[s.code,s]));
let stationTrains = {};
let scheduleIndex = {};
const scheduleCache = new Map();
let dataMode = "fallback";
let dataMeta = null;
