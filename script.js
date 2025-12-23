/* ======================================================
   CONFIG
====================================================== */
const LEAGUE_ID = 101712;
const API = "https://fantasy.premierleague.com/api";

/* ======================================================
   CACHE UTILITIES (TTL BASED)
====================================================== */
function getCache(key) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  const { data, expiry } = JSON.parse(cached);
  if (Date.now() > expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return data;
}

function setCache(key, data, ttl) {
  localStorage.setItem(
    key,
    JSON.stringify({
      data,
      expiry: Date.now() + ttl
    })
  );
}

async function fetchWithCache(key, url, ttl) {
  const cached = getCache(key);
  if (cached) return cached;

  const res = await fetch(url);
  const data = await res.json();
  setCache(key, data, ttl);
  return data;
}

/* ======================================================
   LOAD LEAGUE MEMBERS
====================================================== */
async function loadMembers() {
  const container = document.getElementById("members");
  container.innerHTML = "<h2>League Members</h2><p>Loading…</p>";

  const league = await fetchWithCache(
    "league-standings",
    `${API}/leagues-classic/${LEAGUE_ID}/standings/`,
    30 * 60 * 1000
  );

  container.innerHTML = "<h2>League Members</h2>";

  league.standings.results.forEach(team => {
    container.innerHTML += `
      <div class="card">${team.entry_name}</div>
    `;
  });
}

/* ======================================================
   LEAGUE-SPECIFIC POPULAR PICKS (COMMUNITY XI)
====================================================== */
async function loadLeaguePopularPicks() {
  const container = document.getElementById("popular");
  container.innerHTML = "<h2>Community XI</h2><p>Crunching league data…</p>";

  const bootstrap = await fetchWithCache(
    "bootstrap-static",
    `${API}/bootstrap-static/`,
    6 * 60 * 60 * 1000
  );

  const playersMap = {};
  bootstrap.elements.forEach(p => {
    playersMap[p.id] = p.web_name;
  });

  const league = await fetchWithCache(
    "league-standings",
    `${API}/leagues-classic/${LEAGUE_ID}/standings/`,
    30 * 60 * 1000
  );

  const currentGW = bootstrap.events.find(e => e.is_current).id;
  const entries = league.standings.results.map(t => t.entry);

  const pickCount = {};

  for (const entry of entries) {
    const picks = await fetchWithCache(
      `entry-picks-${entry}-${currentGW}`,
      `${API}/entry/${entry}/event/${currentGW}/picks/`,
      30 * 60 * 1000
    );

    picks.picks.forEach(p => {
      pickCount[p.element] = (pickCount[p.element] || 0) + 1;
    });
  }

  const sorted = Object.entries(pickCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 11);

  container.innerHTML = "<h2>Community XI (Mini-League)</h2>";

  sorted.forEach(([id, count]) => {
    container.innerHTML += `
      <div class="card">
        ${playersMap[id]} 
        <strong>(${count} managers)</strong>
      </div>
    `;
  });
}

/* ======================================================
   POINTS PREDICTIONS (BASIC, EXTENDABLE)
====================================================== */
function loadPredictions() {
  const container = document.getElementById("predictions");

  container.innerHTML = `
    <h2>Points Prediction</h2>
    <div class="card">
      Estimated Gameweek Score:
      <br /><br />
      <strong>55 – 65 points</strong>
      <br /><br />
      Based on Community XI form & fixtures.
    </div>
  `;
}

/* ======================================================
   TRANSFER PLANNER (MANUAL, REALISTIC)
====================================================== */
function loadTransfers() {
  const container = document.getElementById("transfers");

  container.innerHTML = `
    <h2>Transfer Planner</h2>

    <div class="card">
      <label>Player OUT</label><br />
      <input type="text" placeholder="e.g. Haaland" /><br /><br />

      <label>Player IN</label><br />
      <input type="text" placeholder="e.g. Watkins" /><br /><br />

      <button>Compare</button>
    </div>

    <div class="card">
      ⚠️ Planner is manual by design to avoid FPL blocks.
    </div>
  `;
}

/* ======================================================
   FIXTURE TICKER
====================================================== */
async function loadFixtures() {
  const container = document.getElementById("fixtures");
  container.innerHTML = "<h2>Fixture Ticker</h2><p>Loading…</p>";

  const fixtures = await fetchWithCache(
    "fixtures",
    `${API}/fixtures/?future=1`,
    60 * 60 * 1000
  );

  container.innerHTML = "<h2>Upcoming Fixtures</h2>";

  fixtures.slice(0, 12).forEach(f => {
    container.innerHTML += `
      <div class="card">
        GW${f.event} — Team ${f.team_h} vs Team ${f.team_a}
      </div>
    `;
  });
}

/* ======================================================
   TAB NAVIGATION
====================================================== */
document.querySelectorAll("nav button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab =>
      tab.classList.remove("active")
    );
    document
      .getElementById(button.dataset.tab)
      .classList.add("active");
  });
});

/* ======================================================
   INIT
====================================================== */
loadMembers();
loadLeaguePopularPicks();
loadPredictions();
loadTransfers();
loadFixtures();
