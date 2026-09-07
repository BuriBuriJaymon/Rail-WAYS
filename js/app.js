const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt = v => v == null || v === '' ? '—' : Number(v).toLocaleString('en-IN');
const displayRuns = v => Array.isArray(v) ? (v.length ? v.join(' · ') : 'Not provided by source') : (v || 'Not provided by source');

function stationName(code){ return stationByCode[code]?.name || code || '—'; }
function setDate(){
  const d = new Date();
  const iso = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $('dateInput').value = iso;
  $('plannerDate').value = iso;
}
function setMessage(text,type='info'){
  const el=$('dataMessage'); el.className=`data-message ${type}`; el.textContent=text;
}
function stats(){
  $('trainCount').textContent=trains.length.toLocaleString('en-IN');
  $('stationCount').textContent=stations.length.toLocaleString('en-IN');
  $('dataStatus').textContent=dataMode==='live'?'LAYER 1 DATA':dataMode.toUpperCase();
  if(dataMeta){
    $('scheduleCount').textContent=(dataMeta.scheduleTrainCount||0).toLocaleString('en-IN');
    $('sourceLabel').textContent='NEO2308 GTFS';
  }
}

function renderTrains(list=trains){
  const box=$('trainResults');
  if(!list.length){
    box.innerHTML='<div class="empty-state"><h3>No trains found</h3><p>Try a train number, train name, source station, destination station or type.</p></div>';
    return;
  }
  box.innerHTML=list.slice(0,60).map(t=>`<article class="train-card">
    <div class="train-top"><div class="train-number">${esc(t.number)}</div><span class="train-type">${esc(t.type||'Train')}</span></div>
    <div class="train-name">${esc(t.name||'Unnamed train')}</div>
    <div class="route-row"><div class="route-point"><strong>${esc(t.departure||'—')}</strong><span>${esc(t.from||'—')}</span></div><div class="route-line"></div><div class="route-point"><strong>${esc(t.arrival||'—')}</strong><span>${esc(t.to||'—')}</span></div></div>
    <div class="detail-strip"><span>${fmt(t.distance)} km</span><span>${fmt(t.stopsCount)} stops</span><span>${esc(displayRuns(t.runsDays))}</span></div>
    <div class="card-footer"><span>${esc(t.fromName||stationName(t.from))} → ${esc(t.toName||stationName(t.to))}</span><button class="details-btn" data-train="${esc(t.number)}">View timetable →</button></div>
  </article>`).join('');
}

function renderStations(list=stations){
  const box=$('stationGrid');
  if(!list.length){ box.innerHTML='<div class="empty-state"><h3>No station found</h3><p>Try another station name or code.</p></div>'; return; }
  box.innerHTML=list.slice(0,80).map(s=>`<article class="station-card" data-station="${esc(s.code)}">
    <div class="station-code">${esc(s.code)}</div><h3>${esc(s.name)}</h3>
    <p>${esc([s.city,s.state].filter(Boolean).join(', ')||s.address||'')}</p>
    <small>${s.zone?`Zone: ${esc(s.zone)}`:'Railway zone unavailable'}</small>
    ${s.latitude!=null?`<small>${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}</small>`:''}
  </article>`).join('');
}

function populatePlanner(){
  const options=stations.map(s=>`<option value="${esc(s.code)}">${esc(s.name)} (${esc(s.code)})</option>`).join('');
  $('originSelect').innerHTML=options; $('destinationSelect').innerHTML=options;
  if(stationByCode.NDLS) $('originSelect').value='NDLS';
  if(stationByCode.PNBE) $('destinationSelect').value='PNBE';
}

function filterTrains(){
  const q=$('trainSearch').value.trim().toLowerCase();
  const type=$('typeFilter').value;
  renderTrains(trains.filter(t=>{
    const text=`${t.number} ${t.name} ${t.from} ${t.to} ${t.fromName} ${t.toName} ${t.type}`.toLowerCase();
    return (!q||text.includes(q))&&(type==='all'||t.type.toLowerCase()===type.toLowerCase());
  }));
}
function filterStations(){
  const q=$('stationSearch').value.trim().toLowerCase();
  renderStations(stations.filter(s=>!q||`${s.code} ${s.name} ${s.city} ${s.state} ${s.zone}`.toLowerCase().includes(q)));
}

async function loadJSON(path){
  const r=await fetch(`${DATA_ROOT}/${path}`,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}
async function loadCurrentData(){
  const b=$('loadDataBtn'); b.disabled=true; b.textContent='Loading Layer 1 data…';
  setMessage('Loading the browser-optimized railway database…','loading');
  try{
    [stations,trains,stationTrains,scheduleIndex,dataMeta]=await Promise.all([
      loadJSON('stations.json'),loadJSON('trains.json'),loadJSON('station_trains.json'),loadJSON('schedule_index.json'),loadJSON('meta.json')
    ]);
    stationByCode=Object.fromEntries(stations.map(s=>[s.code,s]));
    dataMode='live'; stats(); renderTrains(); renderStations(); populatePlanner();
    setMessage(`Loaded ${fmt(dataMeta.trainCount)} trains, ${fmt(dataMeta.stationCount)} stations and ${fmt(dataMeta.scheduleTrainCount)} timetables from the Neo2308 GTFS snapshot. Build: ${new Date(dataMeta.generatedAt).toLocaleString('en-IN')}.`,'success');
    b.textContent='Layer 1 data loaded ✓';
  }catch(e){
    console.error(e); dataMode='error'; stats();
    setMessage('The railway database could not be loaded. The site will not show sample/fake train data. Check the latest GitHub Actions build and retry.','error');
    b.disabled=false; b.textContent='Retry loading data';
  }
}

async function loadScheduleChunk(number){
  const bucket=scheduleIndex[String(number)];
  if(!bucket) return null;
  if(scheduleCache.has(bucket)) return scheduleCache.get(bucket);
  const promise=loadJSON(`schedule_chunks/${bucket}.json`);
  scheduleCache.set(bucket,promise);
  return promise;
}
async function trainRows(number){
  const chunk=await loadScheduleChunk(number);
  const value=chunk?.[String(number)];
  if(Array.isArray(value)) return value[0]?.rows || [];
  return value || [];
}

async function trainVariants(number){
  const chunk=await loadScheduleChunk(number);
  const value=chunk?.[String(number)];
  if(Array.isArray(value)) return value;
  return value ? [{rows:value}] : [];
}
async function openTrain(number){
  const t=trains.find(x=>String(x.number)===String(number)); if(!t)return;
  $('modalContent').innerHTML=`<div class="loading-box"><span class="eyebrow">TRAIN TIMETABLE</span><h2>${esc(t.number)} — ${esc(t.name)}</h2><p>Loading the complete stop-by-stop route…</p></div>`;
  $('trainModal').classList.add('open'); $('trainModal').setAttribute('aria-hidden','false');
  try{
    const rows=await trainRows(t.number);
    $('modalContent').innerHTML=`<span class="eyebrow">${esc(t.type||'TRAIN')}</span><h2>${esc(t.number)} — ${esc(t.name)}</h2><p>${esc(t.fromName||stationName(t.from))} → ${esc(t.toName||stationName(t.to))}</p>
      <div class="detail-grid">
        <div><b>Train number</b><span>${esc(t.number)}</span></div><div><b>Type</b><span>${esc(t.type||'—')}</span></div><div><b>Runs</b><span>${esc(displayRuns(t.runsDays))}</span></div>
        <div><b>Distance</b><span>${fmt(t.distance)} km</span></div><div><b>Stops</b><span>${fmt(t.stopsCount)}</span></div><div><b>Classes</b><span>${esc((t.classes||[]).join(', ')||'Not provided')}</span></div><div><b>Schedule variants</b><span>${fmt(t.variantCount||1)}</span></div>
      </div>
      ${rows.length?`<h3>Complete timetable</h3><div class="table-wrap"><table class="timetable"><thead><tr><th>#</th><th>Station</th><th>Day</th><th>Arrival</th><th>Departure</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${esc(s.seq)}</td><td><strong>${esc(s.code)}</strong><br>${esc(s.name)}</td><td>${esc(s.day??'—')}</td><td>${esc(s.arr||'—')}</td><td>${esc(s.dep||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="notice"><strong>No timetable rows found.</strong></div>'}
      <p class="footer-note">${esc(SOURCE_INFO.note)} ${dataMeta?.sourceUrl?`Source: ${esc(dataMeta.sourceUrl)}`:''}</p>`;
  }catch(e){ $('modalContent').innerHTML='<div class="notice"><strong>Could not load timetable.</strong> Please try again.</div>'; }
}
function closeModal(){ $('trainModal').classList.remove('open'); $('trainModal').setAttribute('aria-hidden','true'); }

function intersect(a,b){ const set=new Set(b||[]); return (a||[]).filter(x=>set.has(x)); }
async function directTrains(from,to){
  const candidates=intersect(stationTrains[from],stationTrains[to]);
  const out=[];
  const byNumber=Object.fromEntries(trains.map(t=>[String(t.number),t]));
  for(const n of candidates){
    const rows=await trainRows(n); const i=rows.findIndex(x=>x.code===from), j=rows.findIndex(x=>x.code===to);
    if(i>=0&&j>i) out.push({t:byNumber[String(n)],rows:rows.slice(i,j+1),changes:0});
  }
  return out.filter(x=>x.t).sort((a,b)=>(Number(a.t.durationHours)||999)-(Number(b.t.durationHours)||999));
}
async function oneChange(from,to){
  // Keep this intentionally conservative: identify likely interchange stations from the
  // source graph, then verify actual order in both train timetables.
  const candidates=[]; const fromTrains=stationTrains[from]||[]; const toTrains=new Set(stationTrains[to]||[]);
  const byNumber=Object.fromEntries(trains.map(t=>[String(t.number),t]));
  const candidateMids=new Map();
  for(const code of Object.keys(stationTrains)){
    if(code===from||code===to)continue;
    const a=intersect(fromTrains,stationTrains[code]); const b=intersect(stationTrains[code],stationTrains[to]);
    if(a.length&&b.length) candidateMids.set(code,[a[0],b[0]]);
    if(candidateMids.size>=80)break;
  }
  for(const [mid,[a,b]] of candidateMids){
    const [r1,r2]=await Promise.all([trainRows(a),trainRows(b)]);
    const i=r1.findIndex(x=>x.code===from), k=r1.findIndex(x=>x.code===mid), m=r2.findIndex(x=>x.code===mid), j=r2.findIndex(x=>x.code===to);
    if(i>=0&&k>i&&m>=0&&j>m) candidates.push({first:byNumber[String(a)],second:byNumber[String(b)],mid,changes:1});
    if(candidates.length>=8)break;
  }
  return candidates.filter(x=>x.first&&x.second);
}
function renderRoutes(routes){
  const box=$('plannerResults');
  if(!routes.length){ box.innerHTML='<div class="empty-state"><h3>No route found in this dataset</h3><p>Try another station pair. Results are limited to the trains present in the current Rail-WAYS timetable snapshot.</p></div>'; return; }
  box.innerHTML=`<div class="result-list">${routes.map((r,i)=>r.changes===0?`<article class="result-card"><div class="result-main"><strong>${esc(r.t.number)} — ${esc(r.t.name)}</strong><p>${esc(r.t.fromName||stationName(r.t.from))} → ${esc(r.t.toName||stationName(r.t.to))}</p></div><div class="result-meta"><span>Direct</span><span>${esc(r.rows[0]?.dep||'—')} → ${esc(r.rows.at(-1)?.arr||'—')}</span><span>${fmt(r.t.distance)} km</span></div><div class="result-score"><b>${i===0?'Best time in snapshot':'Direct'}</b><small>${esc(r.t.duration||'—')}</small></div></article>`:`<article class="result-card"><div class="result-main"><strong>${esc(r.first.number)} + ${esc(r.second.number)}</strong><p>${esc(r.first.fromName||stationName(r.first.from))} → ${esc(stationName(r.mid))} → ${esc(r.second.toName||stationName(r.second.to))}</p></div><div class="result-meta"><span>1 change</span><span>via ${esc(r.mid)}</span></div><div class="result-score"><b>Candidate</b><small>Connection timing requires deeper optimisation.</small></div></article>`).join('')}</div><p class="footer-note">Layer 1 searches timetable structure. It does not claim live availability, live delay, fares or booking information.</p>`;
}
async function findRoutes(from,to,maxChanges){
  if(dataMode!=='live') return [];
  const direct=await directTrains(from,to); let routes=direct;
  if(maxChanges>0&&direct.length<8) routes=routes.concat(await oneChange(from,to));
  return routes.slice(0,12);
}

$('loadDataBtn').addEventListener('click',loadCurrentData);
$('trainSearch').addEventListener('input',filterTrains);
$('typeFilter').addEventListener('change',filterTrains);
$('stationSearch').addEventListener('input',filterStations);
$('trainResults').addEventListener('click',e=>{const b=e.target.closest('[data-train]');if(b)openTrain(b.dataset.train);});
document.querySelectorAll('[data-close]').forEach(e=>e.addEventListener('click',closeModal));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('swapBtn').addEventListener('click',()=>{const a=$('fromInput').value;$('fromInput').value=$('toInput').value;$('toInput').value=a;});
$('quickSearch').addEventListener('submit',e=>{e.preventDefault();const find=v=>{const q=v.trim().toLowerCase();return stations.find(s=>s.code.toLowerCase()===q||s.name.toLowerCase()===q)||stations.find(s=>s.name.toLowerCase().includes(q));};const a=find($('fromInput').value),b=find($('toInput').value);if(a&&b){$('originSelect').value=a.code;$('destinationSelect').value=b.code;$('planner').scrollIntoView({behavior:'smooth'});$('plannerForm').requestSubmit();}else{$('trainSearch').value=`${$('fromInput').value} ${$('toInput').value}`.trim();$('trains').scrollIntoView({behavior:'smooth'});filterTrains();}});
$('plannerForm').addEventListener('submit',async e=>{e.preventDefault();$('plannerResults').innerHTML='<div class="loading-box"><h3>Searching the timetable graph…</h3><p>Checking trains serving both stations and verifying stop order.</p></div>';const routes=await findRoutes($('originSelect').value,$('destinationSelect').value,Number($('maxChanges').value));renderRoutes(routes);});
$('menuBtn').addEventListener('click',()=>$('nav').classList.toggle('open'));
setDate(); stats(); renderTrains(); renderStations(); populatePlanner(); loadCurrentData();
