const $ = (id) => document.getElementById(id);

let stationByCode = Object.fromEntries(stations.map(s => [s.code, s]));

function stationName(code){
  return stationByCode[code]?.name || code;
}

function setDefaultDates(){
  const d = new Date();
  const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $("dateInput").value = iso;
  $("plannerDate").value = iso;
}

function formatNumber(value){
  return value == null || value === "" ? "—" : Number(value).toLocaleString("en-IN");
}

function renderStats(){
  $("trainCount").textContent = trains.length.toLocaleString("en-IN");
  $("stationCount").textContent = stations.length.toLocaleString("en-IN");
  $("dataStatus").textContent = dataMode === "live" ? "PUBLIC DATA LOADED" : "FALLBACK DATA";
}

function renderTrains(list = trains){
  const box = $("trainResults");
  if(!list.length){
    box.innerHTML = `<div class="empty-state"><h3>No trains found</h3><p>Try a different train number, name, source or destination.</p></div>`;
    return;
  }
  box.innerHTML = list.slice(0, 80).map(t => `
    <article class="train-card">
      <div class="train-top">
        <div class="train-number">${t.number}</div>
        <span class="train-type">${t.type || "Train"}</span>
      </div>
      <div class="train-name">${escapeHtml(t.name || "Unnamed train")}</div>
      <div class="route-row">
        <div class="route-point"><strong>${t.departure || "—"}</strong><span>${escapeHtml(t.from || "—")}</span></div>
        <div class="route-line"></div>
        <div class="route-point"><strong>${t.arrival || "—"}</strong><span>${escapeHtml(t.to || "—")}</span></div>
      </div>
      <div class="detail-strip">
        <span>Distance: ${formatNumber(t.distance)} km</span>
        <span>Stops: ${formatNumber(t.stopsCount)}</span>
        <span>Duration: ${t.duration || "—"}</span>
      </div>
      <div class="card-footer">
        <span>${t.zone ? `Zone: ${escapeHtml(t.zone)}` : "Schedule details available on request"}</span>
        <button class="details-btn" data-train="${escapeHtml(t.number)}">View details →</button>
      </div>
    </article>
  `).join("");
}

function renderStations(){
  $("stationGrid").innerHTML = stations.slice(0, 120).map(s => `
    <article class="station-card">
      <div class="station-code">${escapeHtml(s.code)}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.city || "")}${s.state ? `, ${escapeHtml(s.state)}` : ""}</p>
      <small>${s.zone ? `Zone: ${escapeHtml(s.zone)}` : "Zone unavailable"}</small>
      ${s.latitude != null ? `<small>Coordinates: ${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}</small>` : ""}
    </article>
  `).join("");
}

function populatePlanner(){
  const options = stations.slice(0, 3000).map(s => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>`).join("");
  $("originSelect").innerHTML = options;
  $("destinationSelect").innerHTML = options;
  if(stationByCode.NDLS) $("originSelect").value = "NDLS";
  if(stationByCode.PNBE) $("destinationSelect").value = "PNBE";
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
}

function normalizeStation(feature){
  const p = feature.properties || feature;
  const coordinates = feature.geometry?.coordinates || [];
  return {
    code: p.code || p.station_code || "",
    name: p.name || p.station_name || "",
    city: p.city || "",
    state: p.state || "",
    zone: p.zone || "",
    address: p.address || "",
    longitude: p.longitude ?? coordinates[0],
    latitude: p.latitude ?? coordinates[1]
  };
}

function normalizeTrain(feature){
  const p = feature.properties || feature;
  return {
    number: String(p.number || p.train_number || ""),
    name: p.name || p.train_name || "",
    type: p.type || "Train",
    from: p.from_station_code || p.source || "",
    to: p.to_station_code || p.destination || "",
    fromName: p.from_station_name || "",
    toName: p.to_station_name || "",
    departure: p.departure || "",
    arrival: p.arrival || "",
    duration: p.duration_h != null ? `${p.duration_h}h ${p.duration_m || 0}m` : (p.duration || ""),
    distance: p.distance,
    zone: p.zone || "",
    stopsCount: null
  };
}

async function loadPublicDataset(){
  const btn = $("loadDataBtn");
  btn.disabled = true;
  btn.textContent = "Loading public railway data…";
  setDataMessage("Loading station and train records from the public dataset. This can take a little while because the train file is large.", "loading");
  try {
    const [stationResponse, trainResponse] = await Promise.all([
      fetch(DATA_SOURCES.stations, {cache:"no-store"}),
      fetch(DATA_SOURCES.trains, {cache:"no-store"})
    ]);
    if(!stationResponse.ok || !trainResponse.ok) throw new Error("Remote dataset request failed.");
    const [stationGeo, trainGeo] = await Promise.all([stationResponse.json(), trainResponse.json()]);
    stations = (stationGeo.features || []).map(normalizeStation).filter(s => s.code && s.name);
    trains = (trainGeo.features || []).map(normalizeTrain).filter(t => t.number);
    stationByCode = Object.fromEntries(stations.map(s => [s.code, s]));
    dataMode = "live";
    renderStats();
    renderTrains();
    renderStations();
    populatePlanner();
    setDataMessage(`Loaded ${stations.length.toLocaleString("en-IN")} stations and ${trains.length.toLocaleString("en-IN")} train records from the public reference dataset.`, "success");
    btn.textContent = "Public dataset loaded ✓";
  } catch(error){
    console.error(error);
    setDataMessage("The remote dataset could not be loaded. The site is using its small fallback dataset instead.", "error");
    btn.disabled = false;
    btn.textContent = "Retry loading public data";
  }
}

function setDataMessage(message, type="info"){
  const el = $("dataMessage");
  el.className = `data-message ${type}`;
  el.textContent = message;
}

async function ensureSchedules(){
  if(schedules) return schedules;
  if(scheduleLoading) return null;
  scheduleLoading = true;
  setDataMessage("Loading the full public schedule file. This file is much larger than the station/train files and is loaded only when timetable details are requested.", "loading");
  try {
    const response = await fetch(DATA_SOURCES.schedules, {cache:"no-store"});
    if(!response.ok) throw new Error("Schedule dataset request failed.");
    schedules = await response.json();
    buildStopCounts();
    setDataMessage("Full schedule data loaded for this browser session.", "success");
    return schedules;
  } catch(error){
    console.error(error);
    setDataMessage("The full schedule file could not be loaded. Showing available train-level information only.", "error");
    return null;
  } finally {
    scheduleLoading = false;
  }
}

function buildStopCounts(){
  if(!Array.isArray(schedules)) return;
  const counts = new Map();
  schedules.forEach(s => counts.set(String(s.train_number), (counts.get(String(s.train_number)) || 0) + 1));
  trains.forEach(t => { t.stopsCount = counts.get(String(t.number)) ?? t.stopsCount; });
  renderStats();
  renderTrains(filterCurrentTrains());
}

function filterCurrentTrains(){
  const q = $("trainSearch").value.trim().toLowerCase();
  const type = $("typeFilter").value;
  return trains.filter(t => {
    const text = `${t.number} ${t.name} ${t.from} ${t.to} ${stationName(t.from)} ${stationName(t.to)}`.toLowerCase();
    return (!q || text.includes(q)) && (type === "all" || t.type === type);
  });
}

async function openTrainModal(number){
  const train = trains.find(t => String(t.number) === String(number));
  if(!train) return;
  $("modalContent").innerHTML = `<div class="loading-box"><h2>${escapeHtml(train.number)} — ${escapeHtml(train.name)}</h2><p>Loading detailed timetable…</p></div>`;
  $("trainModal").classList.add("open");
  $("trainModal").setAttribute("aria-hidden","false");

  const scheduleData = await ensureSchedules();
  const rows = Array.isArray(scheduleData) ? scheduleData.filter(s => String(s.train_number) === String(train.number)) : [];
  rows.sort((a,b) => (Number(a.day)||0) - (Number(b.day)||0));

  $("modalContent").innerHTML = `
    <span class="eyebrow">${escapeHtml(train.type || "Train")}</span>
    <h2>${escapeHtml(train.number)} — ${escapeHtml(train.name)}</h2>
    <p>${escapeHtml(train.fromName || stationName(train.from))} → ${escapeHtml(train.toName || stationName(train.to))}</p>
    <div class="detail-grid">
      <div><b>Train number</b><span>${escapeHtml(train.number)}</span></div>
      <div><b>Train type</b><span>${escapeHtml(train.type || "—")}</span></div>
      <div><b>Distance</b><span>${formatNumber(train.distance)} km</span></div>
      <div><b>Stops</b><span>${rows.length || formatNumber(train.stopsCount)}</span></div>
      <div><b>Departure</b><span>${escapeHtml(train.departure || "—")}</span></div>
      <div><b>Arrival</b><span>${escapeHtml(train.arrival || "—")}</span></div>
    </div>
    ${rows.length ? `
      <h3>Timetable / stops</h3>
      <table class="timetable"><thead><tr><th>Day</th><th>Station</th><th>Arrival</th><th>Departure</th><th>Halt</th></tr></thead><tbody>
      ${rows.map(s => `<tr><td>${escapeHtml(s.day ?? "—")}</td><td><strong>${escapeHtml(s.station_code || "")}</strong> ${escapeHtml(s.station_name || "")}</td><td>${escapeHtml(s.arrival || "—")}</td><td>${escapeHtml(s.departure || "—")}</td><td>—</td></tr>`).join("")}
      </tbody></table>
    ` : `<div class="notice"><strong>Schedule detail unavailable.</strong> The train-level record loaded, but no matching stop records were found in the schedule snapshot.</div>`}
    <p class="footer-note">Reference dataset: ${escapeHtml(SOURCE_INFO.name)}. This is not a live operational feed.</p>
  `;
}

function closeModal(){
  $("trainModal").classList.remove("open");
  $("trainModal").setAttribute("aria-hidden","true");
}

function findRoutes(origin, destination, maxChanges, budget){
  const direct = trains.filter(t => t.from === origin && t.to === destination).map(t => ({
    label: `${t.number} ${t.name}`,
    detail: `${stationName(t.from)} → ${stationName(t.to)}`,
    duration: t.duration || "—",
    fare: null,
    changes: 0,
    reliability: "Not evaluated"
  }));

  let results = direct;
  if(maxChanges > 0){
    const oneLeg = trains.filter(t => t.from === origin).flatMap(first => trains.filter(second => second.from === first.to && second.to === destination).map(second => ({
      label: `${first.number} + ${second.number}`,
      detail: `${stationName(origin)} → ${stationName(first.to)} → ${stationName(destination)}`,
      duration: "Requires timetable calculation",
      fare: null,
      changes: 1,
      reliability: "Not evaluated"
    })));
    results = results.concat(oneLeg);
  }
  return results.slice(0, 8);
}

function renderPlannerResults(results){
  const box = $("plannerResults");
  if(!results.length){
    box.innerHTML = `<div class="empty-state"><h3>No matching route in the loaded dataset</h3><p>Try another station pair. Full multi-leg optimisation comes later.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="result-list">${results.map((r,i) => `
    <article class="result-card">
      <div class="result-main"><strong>${escapeHtml(r.label)}</strong><p>${escapeHtml(r.detail)}</p></div>
      <div class="result-meta"><span>${r.fare == null ? "Fare: —" : `₹${formatNumber(r.fare)}`}</span><span>${r.changes} change${r.changes === 1 ? "" : "s"}</span><span>${escapeHtml(r.duration)}</span></div>
      <div class="result-score"><b>${i === 0 ? "First matching route" : "Alternative"}</b><small>${escapeHtml(r.reliability)}</small></div>
    </article>`).join("")}</div>
    <p class="footer-note">This is a data-exploration prototype. The optimisation engine will later calculate connection feasibility, waiting time, cost, reliability and delay risk.</p>`;
}

function filterTrains(){
  renderTrains(filterCurrentTrains());
}

$("trainSearch").addEventListener("input", filterTrains);
$("typeFilter").addEventListener("change", filterTrains);
$("loadDataBtn").addEventListener("click", loadPublicDataset);

$("trainResults").addEventListener("click", e => {
  const btn = e.target.closest("[data-train]");
  if(btn) openTrainModal(btn.dataset.train);
});

document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });

$("swapBtn").addEventListener("click", () => {
  const a = $("fromInput").value;
  $("fromInput").value = $("toInput").value;
  $("toInput").value = a;
});

$("quickSearch").addEventListener("submit", e => {
  e.preventDefault();
  const from = $("fromInput").value.trim().toLowerCase();
  const to = $("toInput").value.trim().toLowerCase();
  $("trainSearch").value = `${from} ${to}`.trim();
  document.querySelector("#trains").scrollIntoView({behavior:"smooth"});
  filterTrains();
});

$("plannerForm").addEventListener("submit", e => {
  e.preventDefault();
  const origin = $("originSelect").value;
  const destination = $("destinationSelect").value;
  const maxChanges = Number($("maxChanges").value);
  renderPlannerResults(findRoutes(origin, destination, maxChanges));
});

$("menuBtn").addEventListener("click", () => $("nav").classList.toggle("open"));

setDefaultDates();
renderStats();
renderTrains();
renderStations();
populatePlanner();
