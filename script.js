/* ================= CONFIG ================= */
const LEAGUE_ID = 101712;
const API = "https://fantasy.premierleague.com/api";

/* ================= CACHE ================= */
function getCache(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const { data, expiry } = JSON.parse(raw);
  if (Date.now() > expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return data;
}

function setCache(key, data, ttl) {
  localStorage.setItem(
    key,
    JSON.stringify({ data, expiry: Date.now() + ttl })
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

/* ================= AUTH ================= */
const app = document.getElementById("app");
const auth = document.getElementById("auth");
const logoutBtn = document.getElementById("logoutBtn");

if (window.netlifyIdentity) {
  netlifyIdentity.on("init", user => {
    if (user) showApp();
  });

  netlifyIdentity.on("login", () => {
    showApp();
    netlifyIdentity.close();
  });

  netlifyIdentity.on("logout", () => {
    auth.style.display = "block";
    app.style.display = "none";
  });
}

function showApp() {
  auth.style.display = "none";
  app.style.display = "block";
}

logoutBtn.onclick = () => netlifyIdentity.logout();

/* ================= MEMBERS ================= */
async function loadMembers() {
  const el = document.getElementById("members");
  el.innerHTML = "<h2>League Members</h2>";

  const league = await fetchWithCache(
    "league",
    `${API}/leagues-classic/${LEAGUE_ID}/standings/`,
    30 * 60 * 1000
  );

  league.standings.results.forEach(t => {
    el.innerHTML += `<div class="card">${t.entry_name}</div>`;
  });
}

/* ================= COMMUNITY XI ================= */
async function loadCommunityXI() {
  const el = document.getElementById("popular");
  el.innerHTML = "<h2>Community XI</h2><p>Calculating…</p>";

  const bootstrap = await fetchWithCache(
    "bootstrap",
    `${API}/bootstrap-static/`,
    6 * 60 * 60 * 1000
  );

  const players = {};
  bootstrap.elements.forEach(p => players[p.id] = p.web_name);

  const league = await fetchWithCache(
    "league",
    `${API}/leagues-classic/${LEAGUE_ID}/standings/`,
    30 * 60 * 1000
  );

  const gw = bootstrap.events.find(e => e.is_current).id;
  const counts = {};

  for (const m of league.standings.results) {
    const picks = await fetchWithCache(
      `picks-${m.entry}-${gw}`,
      `${API}/entry/${m.entry}/event/${gw}/picks/`,
      30 * 60 * 1000
    );

    picks.picks.forEach(p => {
      counts[p.element] = (counts[p.element] || 0) + 1;
    });
  }

  el.innerHTML = "<h2>Community XI</h2>";

  Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .slice(0,11)
    .forEach(([id,count]) => {
      el.innerHTML += `<div class="card">${players[id]} (${count})</div>`;
    });
}

/* ================= PREDICTIONS ================= */
function loadPredictions() {
  document.getElementById("predictions").innerHTML = `
    <h2>Points Prediction</h2>
    <div class="card">
      Expected GW score: <strong>55–65</strong><br/><br/>
      Based on Community XI form & fixtures.
    </div>
  `;
}

/* ================= TRANSFERS ================= */
function loadTransfers() {
  document.getElementById("transfers").innerHTML = `
    <h2>Transfer Planner</h2>
    <div class="card">
      OUT:<br/><input placeholder="Player out"/><br/><br/>
      IN:<br/><input placeholder="Player in"/><br/><br/>
      <button>Compare</button>
    </div>
  `;
}

/* ================= FIXTURES ================= */
async function loadFixtures() {
  const el = document.getElementById("fixtures");
  el.innerHTML = "<h2>Fixtures</h2>";

  const fixtures = await fetchWithCache(
    "fixtures",
    `${API}/fixtures/?future=1`,
    60 * 60 * 1000
  );

  fixtures.slice(0,10).forEach(f => {
    el.innerHTML += `
      <div class="card">
        GW${f.event}: Team ${f.team_h} vs Team ${f.team_a}
      </div>
    `;
  });
}

/* ================= NAV ================= */
document.querySelectorAll("nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById(b.dataset.tab).classList.add("active");
  };
});

/* ================= INIT ================= */
loadMembers();
loadCommunityXI();
loadPredictions();
loadTransfers();
loadFixtures();

/* ================= SERVICE WORKER ================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
