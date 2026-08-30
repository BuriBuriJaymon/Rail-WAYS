// Prototype-only data. These records are deliberately labelled as demo data.
// Replace this layer later with an authorised API/data-ingestion source.

const stations = [
  {code:"NDLS", name:"New Delhi", city:"New Delhi", state:"Delhi"},
  {code:"CNB", name:"Kanpur Central", city:"Kanpur", state:"Uttar Pradesh"},
  {code:"PRYJ", name:"Prayagraj Jn", city:"Prayagraj", state:"Uttar Pradesh"},
  {code:"DDU", name:"Pt. Deen Dayal Upadhyaya Jn", city:"Chandauli", state:"Uttar Pradesh"},
  {code:"GAYA", name:"Gaya Jn", city:"Gaya", state:"Bihar"},
  {code:"PNBE", name:"Patna Jn", city:"Patna", state:"Bihar"},
  {code:"HWH", name:"Howrah Jn", city:"Howrah", state:"West Bengal"},
  {code:"BPL", name:"Bhopal Jn", city:"Bhopal", state:"Madhya Pradesh"},
  {code:"LKO", name:"Lucknow Charbagh", city:"Lucknow", state:"Uttar Pradesh"},
  {code:"AGC", name:"Agra Cantt", city:"Agra", state:"Uttar Pradesh"}
];

const trains = [
  {
    number:"12001", name:"Bhopal Shatabdi", type:"Shatabdi",
    from:"NDLS", to:"BPL", departure:"06:00", arrival:"14:00",
    duration:"8h 00m", changes:0, fare:1450,
    stops:[
      ["NDLS","06:00","06:00"],["AGC","07:48","07:50"],["BPL","14:00","14:00"]
    ]
  },
  {
    number:"12002", name:"New Delhi - Lucknow Shatabdi", type:"Shatabdi",
    from:"NDLS", to:"LKO", departure:"06:10", arrival:"12:25",
    duration:"6h 15m", changes:0, fare:1250,
    stops:[
      ["NDLS","06:10","06:10"],["CNB","10:58","11:00"],["LKO","12:25","12:25"]
    ]
  },
  {
    number:"12301", name:"Howrah - New Delhi Rajdhani", type:"Rajdhani",
    from:"HWH", to:"NDLS", departure:"16:55", arrival:"10:00",
    duration:"17h 05m", changes:0, fare:2100,
    stops:[
      ["HWH","16:55","16:55"],["GAYA","23:05","23:10"],["DDU","01:25","01:30"],["NDLS","10:00","10:00"]
    ]
  },
  {
    number:"22436", name:"New Delhi - Varanasi Vande Bharat", type:"Vande Bharat",
    from:"NDLS", to:"DDU", departure:"06:00", arrival:"14:00",
    duration:"8h 00m", changes:0, fare:1600,
    stops:[
      ["NDLS","06:00","06:00"],["CNB","07:58","08:00"],["PRYJ","10:05","10:08"],["DDU","14:00","14:00"]
    ]
  },
  {
    number:"12310", name:"New Delhi - Rajendra Nagar Rajdhani", type:"Rajdhani",
    from:"NDLS", to:"PNBE", departure:"17:15", arrival:"05:30",
    duration:"12h 15m", changes:0, fare:1950,
    stops:[
      ["NDLS","17:15","17:15"],["CNB","19:45","19:48"],["DDU","00:05","00:10"],["PNBE","05:30","05:30"]
    ]
  },
  {
    number:"12506", name:"North East Express", type:"Superfast",
    from:"NDLS", to:"GAYA", departure:"06:45", arrival:"20:10",
    duration:"13h 25m", changes:0, fare:1100,
    stops:[
      ["NDLS","06:45","06:45"],["CNB","09:15","09:20"],["PRYJ","11:30","11:35"],["GAYA","20:10","20:10"]
    ]
  },
  {
    number:"12424", name:"New Delhi - Dibrugarh Rajdhani", type:"Rajdhani",
    from:"NDLS", to:"PNBE", departure:"16:10", arrival:"04:40",
    duration:"12h 30m", changes:0, fare:2000,
    stops:[
      ["NDLS","16:10","16:10"],["CNB","18:42","18:45"],["DDU","23:55","00:00"],["PNBE","04:40","04:40"]
    ]
  },
  {
    number:"12280", name:"Taj Express", type:"Express",
    from:"NDLS", to:"AGC", departure:"07:05", arrival:"10:20",
    duration:"3h 15m", changes:0, fare:650,
    stops:[
      ["NDLS","07:05","07:05"],["AGC","10:20","10:20"]
    ]
  }
];
