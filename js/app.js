const $ = (id) => document.getElementById(id);

const stationByCode = Object.fromEntries(stations.map(s => [s.code, s]));

function stationName(code){
  return stationByCode[code]?.name || code;
}

function setDefaultDates(){
  const d = new Date();
  const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $("dateInput").value = iso;
  $("plannerDate").value = iso;
}

function renderStats(){
  $("trainCount").textContent = trains.length;
  $("stationCount").textContent = stations.length;
}

function renderTrains(list = trains){
  const box = $("trainResults");
  if(!list.length){
    box.innerHTML = `<div class="empty-state"><h3>No trains found</h3><p>Try a different train number, name or type.</p></div>`;
    return;
  }
  box.innerHTML = list.map(t => `
    <article class="train-card">
      <div class="train-top">
        <div class="train-number">${t.number}</div>
        <span class="train-type">${t.type}</span>
      </div>
      <div class="train-name">${t.name}</div>
      <div class="route-row">
        <div class="route-point"><strong>${t.departure}</strong><span>${t.from}</span></div>
        <div class="route-line"></div>
        <div class="route-point"><strong>${t.arrival}</strong><span>${t.to}</span></div>
      </div>
      <div class="card-footer">
        <span>${t.duration} • ₹${t.fare.toLocaleString("en-IN")}</span>
        <button class="details-btn" data-train="${t.number}">View timetable →</button>
      </div>
    </article>
  `).join("");
}

function renderStations(){
  $("stationGrid").innerHTML = stations.map(s => `
    <article class="station-card">
      <div class="station-code">${s.code}</div>
      <h3>${s.name}</h3>
      <p>${s.city}, ${s.state}</p>
    </article>
  `).join("");
}

function populatePlanner(){
  const options = stations.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join("");
  $("originSelect").innerHTML = options;
  $("destinationSelect").innerHTML = options;
  $("originSelect").value = "NDLS";
  $("destinationSelect").value = "PNBE";
}

function openTrainModal(number){
  const train = trains.find(t => t.number === number);
  if(!train) return;
  $("modalContent").innerHTML = `
    <span class="eyebrow">${train.type}</span>
    <h2>${train.number} — ${train.name}</h2>
    <p>${stationName(train.from)} → ${stationName(train.to)} · ${train.duration} · Approx. ₹${train.fare.toLocaleString("en-IN")}</p>
    <table class="timetable">
      <thead><tr><th>Station</th><th>Arrival</th><th>Departure</th></tr></thead>
      <tbody>
        ${train.stops.map(s => `<tr><td><strong>${s[0]}</strong> ${stationName(s[0])}</td><td>${s[1]}</td><td>${s[2]}</td></tr>`).join("")}
      </tbody>
    </table>
    <p class="footer-note">Prototype timetable — not live operational data.</p>
  `;
  $("trainModal").classList.add("open");
  $("trainModal").setAttribute("aria-hidden","false");
}

function closeModal(){
  $("trainModal").classList.remove("open");
  $("trainModal").setAttribute("aria-hidden","true");
}

function findRoutes(origin, destination, maxChanges, budget, maxHours){
  const direct = trains.filter(t => t.from === origin && t.to === destination && t.changes <= maxChanges);
  const oneLeg = trains.filter(t => t.from === origin).flatMap(first => {
    return trains
      .filter(second => second.from === first.to && second.to === destination)
      .map(second => ({
        first, second,
        changes: 1,
        duration: "Multi-leg",
        fare: first.fare + second.fare
      }));
  }).filter(r => r.changes <= maxChanges);

  let results = direct.map(t => ({
    label: `${t.number} ${t.name}`,
    detail: `${stationName(t.from)} → ${stationName(t.to)}`,
    duration: t.duration,
    fare: t.fare,
    changes: 0,
    reliability: "High"
  }));

  oneLeg.forEach(r => results.push({
    label: `${r.first.number} + ${r.second.number}`,
    detail: `${stationName(origin)} → ${stationName(r.first.to)} → ${stationName(destination)}`,
    duration: "Calculated later",
    fare: r.fare,
    changes: 1,
    reliability: "To be evaluated"
  }));

  if(budget > 0) results = results.filter(r => r.fare <= budget);

  return results.slice(0, 8);
}

function renderPlannerResults(results){
  const box = $("plannerResults");
  if(!results.length){
    box.innerHTML = `<div class="empty-state"><h3>No feasible prototype route</h3><p>Try increasing the budget or maximum number of changes.</p></div>`;
    return;
  }
  box.innerHTML = `
    <div class="result-list">
      ${results.map((r,i) => `
        <article class="result-card">
          <div class="result-main">
            <strong>${r.label}</strong>
            <p>${r.detail}</p>
          </div>
          <div class="result-meta">
            <span>₹${r.fare.toLocaleString("en-IN")}</span>
            <span>${r.changes} change${r.changes === 1 ? "" : "s"}</span>
            <span>${r.duration}</span>
          </div>
          <div class="result-score"><b>${i === 0 ? "Prototype best match" : "Alternative"}</b><small>${r.reliability}</small></div>
        </article>
      `).join("")}
    </div>
    <p class="footer-note">Prototype result ranking. The final optimisation engine will use timetable compatibility, time, cost, reliability, waiting time, delay risk and user constraints.</p>
  `;
}

$("trainSearch").addEventListener("input", filterTrains);
$("typeFilter").addEventListener("change", filterTrains);

function filterTrains(){
  const q = $("trainSearch").value.trim().toLowerCase();
  const type = $("typeFilter").value;
  const list = trains.filter(t => {
    const matchesQ = !q || `${t.number} ${t.name} ${stationName(t.from)} ${stationName(t.to)}`.toLowerCase().includes(q);
    const matchesType = type === "all" || t.type === type;
    return matchesQ && matchesType;
  });
  renderTrains(list);
}

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
  $("trainSearch").value = from || to;
  document.querySelector("#trains").scrollIntoView({behavior:"smooth"});
  filterTrains();
});

$("plannerForm").addEventListener("submit", e => {
  e.preventDefault();
  const origin = $("originSelect").value;
  const destination = $("destinationSelect").value;
  const maxChanges = Number($("maxChanges").value);
  const budget = Number($("budgetInput").value) || 0;
  const duration = $("durationInput").value;
  const maxHours = duration === "any" ? Infinity : Number(duration);
  renderPlannerResults(findRoutes(origin, destination, maxChanges, budget, maxHours));
});

$("menuBtn").addEventListener("click", () => $("nav").classList.toggle("open"));

setDefaultDates();
renderStats();
renderTrains();
renderStations();
populatePlanner();
