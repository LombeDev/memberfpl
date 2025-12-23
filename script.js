/* ================= CONFIGURATION ================= */
const LEAGUE_ID = 101712;
// This tells the browser to use YOUR Netlify server, not an external proxy
const PROXY_URL = "/.netlify/functions/fpl-proxy"; 

/* ================= CACHE ENGINE ================= */
async function fetchFPL(key, path, ttl = 1800000) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() < expiry && data !== null) return data;
    }

    try {
        // We call our internal Netlify function here
        const res = await fetch(`${PROXY_URL}?path=${encodeURIComponent(path)}`);
        
        if (!res.ok) throw new Error(`Server Error: ${res.status}`);
        
        const data = await res.json();

        localStorage.setItem(key, JSON.stringify({
            data,
            expiry: Date.now() + ttl
        }));
        return data;
    } catch (err) {
        console.error(`Error fetching ${path}:`, err);
        return null;
    }
}

/* ================= AUTHENTICATION ================= */
if (window.netlifyIdentity) {
    netlifyIdentity.on("init", user => { if (user) showDashboard(); });
    netlifyIdentity.on("login", user => { showDashboard(); netlifyIdentity.close(); });
    netlifyIdentity.on("logout", () => { localStorage.clear(); location.reload(); });
}

function showDashboard() {
    document.getElementById("auth-overlay").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadAllSections();
}

document.getElementById("logoutBtn").onclick = () => netlifyIdentity.logout();

/* ================= NAVIGATION ================= */
document.querySelectorAll(".nav-link").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".nav-link, .tab-content").forEach(el => el.classList.remove("active", "active-tab"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active-tab");
    };
});

/* ================= DATA RENDERING ================= */
async function loadAllSections() {
    const bootstrap = await fetchFPL("fpl_bootstrap", "bootstrap-static", 86400000);
    const league = await fetchFPL("fpl_league", `leagues-classic/${LEAGUE_ID}/standings`);

    if (league && bootstrap) {
        renderMembers(league);
        renderCommunityXI(league, bootstrap);
        renderFixtures(bootstrap);
    } else {
        console.log("Data load failed. Check Netlify Functions tab.");
    }
}

function renderMembers(league) {
    const el = document.getElementById("members");
    el.innerHTML = `<h2>${league.league.name}</h2>` + league.standings.results.map(m => `
        <div class="card">
            <span>${m.rank}. ${m.player_name}</span>
            <span style="color: #00ff87">${m.total} pts</span>
        </div>`).join("");
}

async function renderCommunityXI(league, bootstrap) {
    const el = document.getElementById("popular");
    const currentGW = bootstrap.events.find(e => e.is_current)?.id || 1;
    const playerNames = {};
    bootstrap.elements.forEach(p => playerNames[p.id] = p.web_name);

    const counts = {};
    const topManagers = league.standings.results.slice(0, 5);

    for (const m of topManagers) {
        const picks = await fetchFPL(`picks_${m.entry}_${currentGW}`, `entry/${m.entry}/event/${currentGW}/picks`);
        if (picks?.picks) {
            picks.picks.forEach(p => {
                counts[p.element] = (counts[p.element] || 0) + 1;
            });
        }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 11);
    el.innerHTML = "<h2>Community XI</h2>" + sorted.map(([id, count]) => `
        <div class="card">
            <span>${playerNames[id]}</span>
            <span style="color: #00ff87">${(count / 5) * 100}%</span>
        </div>`).join("");
}

async function renderFixtures(bootstrap) {
    const el = document.getElementById("fixtures");
    const fixtures = await fetchFPL("fpl_fixtures", "fixtures?future=1", 3600000);
    const teams = {}; bootstrap.teams.forEach(t => teams[t.id] = t.name);
    el.innerHTML = "<h2>Next Fixtures</h2>" + fixtures.slice(0, 10).map(f => `
        <div class="card">
            <span>${teams[f.team_h]} vs ${teams[f.team_a]}</span>
            <span style="color: #00ff87">GW${f.event}</span>
        </div>`).join("");
}
