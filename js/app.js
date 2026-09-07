const DATA_ROOT = new URL("generated_data/", document.baseURI).href;

let stations = [];
let trains = [];
let stationByCode = {};
let stationTrains = {};
let scheduleIndex = {};
const scheduleCache = new Map();

let dataMode = "loading";
let dataMeta = null;

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function loadJSON(path) {
  const url = new URL(path, DATA_ROOT);

  return fetch(url.href, {
    cache: "no-store"
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${url.href}`);
    }

    return response.json();
  });
}

function setDateDefaults() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);

  if ($("dateInput")) {
    $("dateInput").value = iso;
  }

  if ($("plannerDate")) {
    $("plannerDate").value = iso;
  }
}

function setDataMessage(message, type = "info") {
  const element = $("dataMessage");

  if (!element) return;

  element.className = `data-message ${type}`;
  element.textContent = message;
}

function setDataStatus(text, type = "") {
  const element = $("dataStatus");

  if (!element) return;

  element.textContent = text;

  if (type) {
    element.dataset.status = type;
  }
}

function updateStats() {
  if ($("trainCount")) {
    $("trainCount").textContent = Number(
      dataMeta?.trainCount ?? trains.length
    ).toLocaleString();
  }

  if ($("stationCount")) {
    $("stationCount").textContent = Number(
      dataMeta?.stationCount ?? stations.length
    ).toLocaleString();
  }

  if ($("scheduleCount")) {
    $("scheduleCount").textContent = Number(
      dataMeta?.scheduleTrainCount ?? Object.keys(scheduleIndex).length
    ).toLocaleString();
  }

  if ($("sourceLabel")) {
    $("sourceLabel").textContent = "Neo2308 GTFS";
  }
}


/* =========================================================
   STATION SEARCH / AUTOCOMPLETE
   ========================================================= */

function stationSearchText(station) {
  return [
    station.code,
    station.name,
    station.city,
    station.state,
    station.zone
  ]
    .filter(Boolean)
    .join(" ");
}

function stationLabel(station) {
  const code = station.code || "";
  const name = station.name || "";

  if (code && name) {
    return `${code} — ${name}`;
  }

  return code || name || "Unknown station";
}

function scoreStation(station, query) {
  const q = normalize(query);

  if (!q) return 0;

  const code = normalize(station.code);
  const name = normalize(station.name);
  const city = normalize(station.city);
  const state = normalize(station.state);
  const full = normalize(stationSearchText(station));

  let score = 0;

  if (code === q) score += 10000;
  if (name === q) score += 9000;
  if (city === q) score += 8000;

  if (code.startsWith(q)) score += 6000;
  if (name.startsWith(q)) score += 5000;
  if (city.startsWith(q)) score += 4000;
  if (state.startsWith(q)) score += 2500;

  if (code.includes(q)) score += 3500;
  if (name.includes(q)) score += 3000;
  if (city.includes(q)) score += 2500;
  if (full.includes(q)) score += 1000;

  return score;
}

function findStation(query) {
  const q = normalize(query);

  if (!q) return null;

  const exactCode = stations.find(
    (station) => normalize(station.code) === q
  );

  if (exactCode) return exactCode;

  const exactName = stations.find(
    (station) => normalize(station.name) === q
  );

  if (exactName) return exactName;

  const exactCity = stations.find(
    (station) => normalize(station.city) === q
  );

  if (exactCity) return exactCity;

  const ranked = stations
    .map((station) => ({
      station,
      score: scoreStation(station, query)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.length ? ranked[0].station : null;
}

function getStationSuggestions(query, limit = 12) {
  const q = normalize(query);

  if (!q) {
    return stations.slice(0, limit);
  }

  return stations
    .map((station) => ({
      station,
      score: scoreStation(station, query)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return String(a.station.name).localeCompare(
        String(b.station.name)
      );
    })
    .slice(0, limit)
    .map((item) => item.station);
}

function populateStationDatalists() {
  const datalists = [
    $("stationOptions"),
    $("quickStationOptions")
  ].filter(Boolean);

  if (!datalists.length || !stations.length) return;

  const fragment = document.createDocumentFragment();

  stations.forEach((station) => {
    const option = document.createElement("option");

    option.value = station.code || station.name || "";

    if (station.name) {
      option.label = `${station.code || ""} — ${station.name}`;
    }

    fragment.appendChild(option);
  });

  datalists.forEach((datalist) => {
    datalist.innerHTML = "";
    datalist.appendChild(fragment.cloneNode(true));
  });
}


/* =========================================================
   CUSTOM AUTOCOMPLETE DROPDOWNS
   ========================================================= */

function createAutocomplete(input) {
  if (!input || input.dataset.autocompleteReady === "true") {
    return;
  }

  input.dataset.autocompleteReady = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "station-autocomplete-wrapper";

  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const dropdown = document.createElement("div");
  dropdown.className = "station-autocomplete";
  dropdown.hidden = true;

  wrapper.appendChild(dropdown);

  function closeDropdown() {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
  }

  function renderSuggestions() {
    const query = input.value.trim();

    if (!query) {
      closeDropdown();
      return;
    }

    const matches = getStationSuggestions(query, 10);

    dropdown.innerHTML = "";

    if (!matches.length) {
      dropdown.innerHTML = `
        <div class="station-autocomplete-empty">
          No matching station found
        </div>
      `;

      dropdown.hidden = false;
      return;
    }

    matches.forEach((station) => {
      const item = document.createElement("button");

      item.type = "button";
      item.className = "station-autocomplete-item";

      item.innerHTML = `
        <strong>${escapeHTML(station.code || "")}</strong>
        <span>${escapeHTML(station.name || "")}</span>
      `;

      if (station.city) {
        item.innerHTML += `
          <small>${escapeHTML(station.city)}</small>
        `;
      }

      item.addEventListener("mousedown", (event) => {
        event.preventDefault();

        input.value = station.code || station.name || "";

        input.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        closeDropdown();
      });

      dropdown.appendChild(item);
    });

    dropdown.hidden = false;
  }

  input.addEventListener("input", renderSuggestions);

  input.addEventListener("focus", () => {
    if (input.value.trim()) {
      renderSuggestions();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDropdown();
    }
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      closeDropdown();
    }
  });
}

function setupAutocomplete() {
  [
    $("originInput"),
    $("destinationInput"),
    $("fromInput"),
    $("toInput")
  ]
    .filter(Boolean)
    .forEach(createAutocomplete);
}


/* =========================================================
   TRAIN SEARCH
   ========================================================= */

function trainMatchesSearch(train, query) {
  const q = normalize(query);

  if (!q) return true;

  const values = [
    train.number,
    train.name,
    train.type,
    train.from,
    train.fromName,
    train.to,
    train.toName
  ];

  return values.some((value) =>
    normalize(value).includes(q)
  );
}

function trainMatchesType(train, type) {
  if (!type || type === "all") {
    return true;
  }

  const trainType = normalize(train.type);
  const wanted = normalize(type);

  return trainType.includes(wanted);
}

function formatDuration(train) {
  if (train.duration) {
    return train.duration;
  }

  if (typeof train.durationHours === "number") {
    const totalMinutes = Math.round(train.durationHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  }

  return "—";
}

function renderTrains() {
  const container = $("trainResults");

  if (!container) return;

  const query = $("trainSearch")?.value || "";
  const type = $("typeFilter")?.value || "all";

  const filtered = trains
    .filter((train) => trainMatchesSearch(train, query))
    .filter((train) => trainMatchesType(train, type));

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⌕</span>
        <h3>No trains found</h3>
        <p>Try a different train number, name, station code or train type.</p>
      </div>
    `;

    return;
  }

  const visible = filtered.slice(0, 100);

  container.innerHTML = visible
    .map((train) => `
      <article class="train-card">

        <div class="train-card-top">
          <div>
            <span class="eyebrow">
              ${escapeHTML(train.type || "TRAIN")}
            </span>

            <h3>
              ${escapeHTML(train.name || "Unnamed train")}
            </h3>

            <strong>
              ${escapeHTML(train.number || "—")}
            </strong>
          </div>

          <button
            class="btn secondary train-view-btn"
            data-train-number="${escapeHTML(train.number || "")}"
            type="button"
          >
            Timetable
          </button>
        </div>

        <div class="train-route">

          <div>
            <small>FROM</small>
            <strong>${escapeHTML(train.from || "—")}</strong>
            <span>${escapeHTML(train.fromName || "—")}</span>
          </div>

          <div class="route-arrow">→</div>

          <div>
            <small>TO</small>
            <strong>${escapeHTML(train.to || "—")}</strong>
            <span>${escapeHTML(train.toName || "—")}</span>
          </div>

        </div>

        <div class="train-meta">

          <span>
            <b>Duration</b>
            ${escapeHTML(formatDuration(train))}
          </span>

          <span>
            <b>Stops</b>
            ${escapeHTML(train.stopsCount ?? "—")}
          </span>

          <span>
            <b>Distance</b>
            ${
              train.distance != null
                ? escapeHTML(`${train.distance} km`)
                : "—"
            }
          </span>

        </div>

      </article>
    `)
    .join("");

  container
    .querySelectorAll(".train-view-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openTrain(button.dataset.trainNumber);
      });
    });

  if (filtered.length > visible.length) {
    container.insertAdjacentHTML(
      "beforeend",
      `
        <div class="data-message info">
          Showing the first ${visible.length.toLocaleString()}
          matching trains out of ${filtered.length.toLocaleString()}.
          Refine your search to narrow the results.
        </div>
      `
    );
  }
}


/* =========================================================
   STATION DIRECTORY
   ========================================================= */

function filterStations() {
  const query = normalize($("stationSearch")?.value || "");

  if (!query) {
    return stations;
  }

  return stations
    .map((station) => ({
      station,
      score: scoreStation(station, query)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.station);
}

function renderStations() {
  const container = $("stationGrid");

  if (!container) return;

  const filtered = filterStations();
  const visible = filtered.slice(0, 100);

  if (!visible.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⌕</span>
        <h3>No station found</h3>
        <p>Try a station code, station name or city.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = visible
    .map((station) => `
      <article class="station-card">

        <div class="station-code">
          ${escapeHTML(station.code || "—")}
        </div>

        <h3>
          ${escapeHTML(station.name || "Unnamed station")}
        </h3>

        ${
          station.city
            ? `<p>${escapeHTML(station.city)}</p>`
            : ""
        }

        ${
          station.state
            ? `<span>${escapeHTML(station.state)}</span>`
            : ""
        }

        ${
          station.zone
            ? `<small>Zone: ${escapeHTML(station.zone)}</small>`
            : ""
        }

        ${
          station.latitude != null &&
          station.longitude != null
            ? `
              <small>
                ${escapeHTML(station.latitude)},
                ${escapeHTML(station.longitude)}
              </small>
            `
            : ""
        }

      </article>
    `)
    .join("");

  if (filtered.length > visible.length) {
    container.insertAdjacentHTML(
      "beforeend",
      `
        <div class="data-message info">
          Showing ${visible.length.toLocaleString()}
          of ${filtered.length.toLocaleString()} matching stations.
        </div>
      `
    );
  }
}


/* =========================================================
   SCHEDULE DATA
   ========================================================= */

async function loadScheduleChunk(chunkName) {
  if (scheduleCache.has(chunkName)) {
    return scheduleCache.get(chunkName);
  }

  const promise = loadJSON(`schedule_chunks/${chunkName}.json`);

  scheduleCache.set(chunkName, promise);

  return promise;
}

function scheduleReferenceForTrain(trainNumber) {
  const value = scheduleIndex?.[trainNumber];

  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return {
      chunk: value,
      key: trainNumber
    };
  }

  if (Array.isArray(value)) {
    return {
      chunk: value[0],
      key: trainNumber
    };
  }

  if (typeof value === "object") {
    return {
      chunk:
        value.chunk ??
        value.file ??
        value.chunkFile ??
        value.part ??
        null,

      key:
        value.key ??
        value.train ??
        value.trainNumber ??
        trainNumber
    };
  }

  return null;
}

function trainRows(chunk, trainNumber) {
  if (!chunk) return [];

  let value = chunk[trainNumber];

  if (value == null) {
    value = chunk[String(trainNumber)];
  }

  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    if (
      value.length &&
      value[0] &&
      Array.isArray(value[0].rows)
    ) {
      return value[0].rows;
    }

    return value.flatMap((variant) => {
      if (variant && Array.isArray(variant.rows)) {
        return variant.rows;
      }

      return Array.isArray(variant) ? variant : [];
    });
  }

  if (value && Array.isArray(value.rows)) {
    return value.rows;
  }

  return [];
}

async function getTrainSchedules(trainNumber) {
  const key = String(trainNumber);

  const reference = scheduleReferenceForTrain(key);

  if (!reference || !reference.chunk) {
    return [];
  }

  const chunk = await loadScheduleChunk(reference.chunk);

  return trainRows(chunk, reference.key);
}

function stationOrder(row) {
  return Number(
    row.seq ??
    row.sequence ??
    row.stopSequence ??
    0
  );
}

function scheduleStationCode(row) {
  return String(
    row.code ??
    row.stationCode ??
    ""
  ).toUpperCase();
}

function verifyRoute(rows, fromCode, toCode) {
  if (!rows.length) return false;

  const from = String(fromCode).toUpperCase();
  const to = String(toCode).toUpperCase();

  const ordered = [...rows].sort(
    (a, b) => stationOrder(a) - stationOrder(b)
  );

  let originIndex = -1;
  let destinationIndex = -1;

  for (let i = 0; i < ordered.length; i++) {
    const code = scheduleStationCode(ordered[i]);

    if (code === from && originIndex === -1) {
      originIndex = i;
    }

    if (code === to && originIndex !== -1) {
      destinationIndex = i;
      break;
    }
  }

  return (
    originIndex !== -1 &&
    destinationIndex !== -1 &&
    originIndex < destinationIndex
  );
}


/* =========================================================
   DIRECT TRAIN SEARCH
   ========================================================= */

async function directTrains(fromCode, toCode) {
  const from = String(fromCode).toUpperCase();
  const to = String(toCode).toUpperCase();

  const fromList = stationTrains?.[from] || [];
  const toList = stationTrains?.[to] || [];

  const toSet = new Set(toList.map(String));

  const candidates = fromList
    .map(String)
    .filter((number) => toSet.has(number));

  const results = [];

  for (const trainNumber of candidates) {
    const train = trains.find(
      (item) => String(item.number) === String(trainNumber)
    );

    if (!train) continue;

    const schedules = await getTrainSchedules(trainNumber);

    const variants = [];

    if (schedules.length) {
      const unique = [];

      for (const schedule of schedules) {
        if (!verifyRoute([schedule], from, to)) {
          continue;
        }

        const exists = unique.some(
          (item) =>
            JSON.stringify(item) === JSON.stringify(schedule)
        );

        if (!exists) {
          unique.push(schedule);
        }
      }

      variants.push(...unique);
    }

    if (!schedules.length || variants.length) {
      results.push({
        train,
        schedules: variants
      });
    }
  }

  return results;
}


/* =========================================================
   PLANNER
   ========================================================= */

function resolvePlannerStation(inputId) {
  const input = $(inputId);

  if (!input) return null;

  const station = findStation(input.value);

  return station;
}

function renderPlannerResults(results, fromStation, toStation) {
  const container = $("plannerResults");

  if (!container) return;

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⌕</span>

        <h3>No direct trains found</h3>

        <p>
          No train in the Layer 1 timetable was found that visits
          ${escapeHTML(fromStation.name)}
          before
          ${escapeHTML(toStation.name)}.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="planner-summary">
      <strong>
        ${results.length.toLocaleString()} direct train${results.length === 1 ? "" : "s"} found
      </strong>

      <span>
        ${escapeHTML(fromStation.code)} →
        ${escapeHTML(toStation.code)}
      </span>
    </div>

    <div class="planner-train-list">

      ${results
        .map(({ train }) => `
          <article class="planner-train">

            <div>
              <span class="eyebrow">
                ${escapeHTML(train.type || "TRAIN")}
              </span>

              <h3>
                ${escapeHTML(train.name || "Unnamed train")}
              </h3>

              <strong>
                ${escapeHTML(train.number || "—")}
              </strong>
            </div>

            <div class="planner-route">

              <span>
                <b>${escapeHTML(train.from || "")}</b>
                ${escapeHTML(train.fromName || "")}
              </span>

              <span>→</span>

              <span>
                <b>${escapeHTML(train.to || "")}</b>
                ${escapeHTML(train.toName || "")}
              </span>

            </div>

            <div class="planner-actions">

              <span>
                ${escapeHTML(formatDuration(train))}
              </span>

              <button
                type="button"
                class="btn secondary train-view-btn"
                data-train-number="${escapeHTML(train.number || "")}"
              >
                View timetable
              </button>

            </div>

          </article>
        `)
        .join("")}

    </div>
  `;

  container
    .querySelectorAll(".train-view-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openTrain(button.dataset.trainNumber);
      });
    });
}

async function runPlanner() {
  const container = $("plannerResults");

  const fromStation = resolvePlannerStation("originInput");
  const toStation = resolvePlannerStation("destinationInput");

  if (!fromStation || !toStation) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>

          <h3>Select valid stations</h3>

          <p>
            Enter a station code or name and choose a matching station
            from the suggestions.
          </p>
        </div>
      `;
    }

    return;
  }

  if (
    normalize(fromStation.code) ===
    normalize(toStation.code)
  ) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>

          <h3>Choose different stations</h3>

          <p>
            Origin and destination cannot be the same station.
          </p>
        </div>
      `;
    }

    return;
  }

  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⌛</span>

        <h3>Searching timetable database…</h3>

        <p>
          Checking trains between
          ${escapeHTML(fromStation.code)}
          and
          ${escapeHTML(toStation.code)}.
        </p>
      </div>
    `;
  }

  try {
    const results = await directTrains(
      fromStation.code,
      toStation.code
    );

    renderPlannerResults(
      results,
      fromStation,
      toStation
    );
  } catch (error) {
    console.error("Planner search failed:", error);

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>

          <h3>Search failed</h3>

          <p>
            The timetable could not be loaded. Please try again.
          </p>
        </div>
      `;
    }
  }
}


/* =========================================================
   TRAIN MODAL / TIMETABLE
   ========================================================= */

function formatTime(value) {
  if (!value) return "—";

  return String(value);
}

function renderScheduleRows(rows) {
  const ordered = [...rows].sort(
    (a, b) => stationOrder(a) - stationOrder(b)
  );

  return ordered
    .map((row) => `
      <tr>

        <td>
          ${escapeHTML(row.seq ?? row.sequence ?? "—")}
        </td>

        <td>
          <strong>
            ${escapeHTML(row.code ?? row.stationCode ?? "—")}
          </strong>
        </td>

        <td>
          ${escapeHTML(row.name ?? row.stationName ?? "—")}
        </td>

        <td>
          ${escapeHTML(
            row.day != null ? `Day ${row.day}` : "—"
          )}
        </td>

        <td>
          ${escapeHTML(
            formatTime(row.arr ?? row.arrival)
          )}
        </td>

        <td>
          ${escapeHTML(
            formatTime(row.dep ?? row.departure)
          )}
        </td>

        <td>
          ${escapeHTML(
            row.halt != null ? row.halt : "—"
          )}
        </td>

        <td>
          ${
            row.distance != null
              ? escapeHTML(`${row.distance} km`)
              : "—"
          }
        </td>

      </tr>
    `)
    .join("");
}

async function openTrain(trainNumber) {
  const train = trains.find(
    (item) =>
      String(item.number) === String(trainNumber)
  );

  if (!train) return;

  const modal = $("trainModal");
  const content = $("modalContent");

  if (!modal || !content) return;

  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");

  content.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">⌛</span>
      <h3>Loading timetable…</h3>
      <p>
        ${escapeHTML(train.number || "")}
        — ${escapeHTML(train.name || "")}
      </p>
    </div>
  `;

  try {
    const schedules = await getTrainSchedules(trainNumber);

    let rows = [];

    if (schedules.length) {
      rows = schedules;
    }

    content.innerHTML = `
      <div class="modal-heading">

        <span class="eyebrow">
          ${escapeHTML(train.type || "TRAIN")}
        </span>

        <h2>
          ${escapeHTML(train.name || "Unnamed train")}
        </h2>

        <strong>
          ${escapeHTML(train.number || "—")}
        </strong>

      </div>

      <div class="train-route">

        <div>
          <small>FROM</small>
          <strong>${escapeHTML(train.from || "—")}</strong>
          <span>${escapeHTML(train.fromName || "—")}</span>
        </div>

        <div class="route-arrow">→</div>

        <div>
          <small>TO</small>
          <strong>${escapeHTML(train.to || "—")}</strong>
          <span>${escapeHTML(train.toName || "—")}</span>
        </div>

      </div>

      <div class="train-meta">

        <span>
          <b>Duration</b>
          ${escapeHTML(formatDuration(train))}
        </span>

        <span>
          <b>Stops</b>
          ${escapeHTML(train.stopsCount ?? "—")}
        </span>

        <span>
          <b>Distance</b>
          ${
            train.distance != null
              ? escapeHTML(`${train.distance} km`)
              : "—"
          }
        </span>

      </div>

      ${
        rows.length
          ? `
            <div class="timetable-wrapper">

              <table class="timetable">

                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Station</th>
                    <th>Day</th>
                    <th>Arrival</th>
                    <th>Departure</th>
                    <th>Halt</th>
                    <th>Distance</th>
                  </tr>
                </thead>

                <tbody>
                  ${renderScheduleRows(rows)}
                </tbody>

              </table>

            </div>
          `
          : `
            <div class="data-message info">
              No timetable rows are available for this train in the
              current upstream snapshot.
            </div>
          `
      }
    `;
  } catch (error) {
    console.error("Timetable loading failed:", error);

    content.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">!</span>

        <h3>Timetable unavailable</h3>

        <p>
          The train record exists, but its timetable could not be loaded.
        </p>
      </div>
    `;
  }
}

function closeModal() {
  const modal = $("trainModal");

  if (!modal) return;

  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
}


/* =========================================================
   QUICK SEARCH
   ========================================================= */

async function runQuickSearch() {
  const from = findStation(
    $("fromInput")?.value || ""
  );

  const to = findStation(
    $("toInput")?.value || ""
  );

  if (!from || !to) {
    window.location.hash = "#planner";

    if ($("plannerResults")) {
      $("plannerResults").innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>

          <h3>Select valid stations</h3>

          <p>
            Enter a station name or code and select a matching station.
          </p>
        </div>
      `;
    }

    return;
  }

  $("originInput").value = from.code;
  $("destinationInput").value = to.code;

  window.location.hash = "#planner";

  await runPlanner();
}


/* =========================================================
   LOAD DATABASE
   ========================================================= */

async function loadCurrentData() {
  dataMode = "loading";

  setDataStatus("LOADING");

  setDataMessage(
    "Loading the Layer 1 railway database…",
    "info"
  );

  try {
    const [
      stationData,
      trainData,
      stationTrainData,
      scheduleData,
      metaData
    ] = await Promise.all([
      loadJSON("stations.json"),
      loadJSON("trains.json"),
      loadJSON("station_trains.json"),
      loadJSON("schedule_index.json"),
      loadJSON("meta.json")
    ]);

    stations = Array.isArray(stationData)
      ? stationData
      : [];

    trains = Array.isArray(trainData)
      ? trainData
      : [];

    stationTrains = stationTrainData || {};
    scheduleIndex = scheduleData || {};
    dataMeta = metaData || {};

    stationByCode = {};

    stations.forEach((station) => {
      if (station.code) {
        stationByCode[
          String(station.code).toUpperCase()
        ] = station;
      }
    });

    dataMode = "ready";

    updateStats();

    renderTrains();
    renderStations();

    populateStationDatalists();
    setupAutocomplete();

    setDataStatus("READY", "ready");

    setDataMessage(
      `${stations.length.toLocaleString()} stations • ${trains.length.toLocaleString()} trains loaded`,
      "success"
    );

  } catch (error) {
    console.error("Rail-WAYS data loading failed:", error);

    dataMode = "error";

    setDataStatus("ERROR", "error");

    setDataMessage(
      "The railway database could not be loaded. Check the GitHub Pages deployment and try again.",
      "error"
    );

    if ($("trainResults")) {
      $("trainResults").innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>

          <h3>Railway database unavailable</h3>

          <p>
            The Layer 1 data files could not be loaded.
          </p>
        </div>
      `;
    }

    if ($("stationGrid")) {
      $("stationGrid").innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>

          <h3>Station database unavailable</h3>

          <p>
            The Layer 1 station data could not be loaded.
          </p>
        </div>
      `;
    }
  }
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

  $("trainSearch")?.addEventListener(
    "input",
    renderTrains
  );

  $("typeFilter")?.addEventListener(
    "change",
    renderTrains
  );

  $("stationSearch")?.addEventListener(
    "input",
    renderStations
  );

  $("loadDataBtn")?.addEventListener(
    "click",
    loadCurrentData
  );

  $("plannerForm")?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      await runPlanner();
    }
  );

  $("quickSearch")?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      await runQuickSearch();
    }
  );

  $("swapBtn")?.addEventListener(
    "click",
    () => {
      const from = $("fromInput");
      const to = $("toInput");

      if (!from || !to) return;

      const temp = from.value;

      from.value = to.value;
      to.value = temp;
    }
  );

  document
    .querySelectorAll("[data-close]")
    .forEach((element) => {
      element.addEventListener(
        "click",
        closeModal
      );
    });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    }
  );

  $("menuBtn")?.addEventListener(
    "click",
    () => {
      $("nav")?.classList.toggle("open");
    }
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

setDateDefaults();
setupEvents();
loadCurrentData();
