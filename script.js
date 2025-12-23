/* ================= CONFIGURATION ================= */
const LEAGUE_ID = 101712;
// This must match your file name in netlify/functions/fpl-proxy.js
const PROXY_URL = "/.netlify/functions/fpl-proxy"; 

/* ================= CACHE ENGINE ================= */
/**
 * Generic fetcher with localStorage caching
 * Fix: Prevents caching 'null' or error responses
 */
async function fetchFPL(key, path, ttl = 1800000) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { data, expiry } = JSON.parse(cached);
        // Only return if not expired AND data actually exists
        if (Date.now() < expiry && data !== null) return data;
    }

    try {
        const res = await fetch(`${PROXY_URL}?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const data = await res.json();
        
        // Safety check: Don't cache if the API returned an error object
        if (data && data.error) throw new Error(data.error);

        localStorage.setItem(key, JSON.stringify({
            data,
            expiry: Date.now() + ttl
        }));
        return data;
    } catch (err) {
        console.error(`Fetch Error [${path}]:`, err);
        return null; 
    }
}

/* ================= AUTHENTICATION ================= */
if (window.netlifyIdentity) {
    netlifyIdentity.on("init", user => {
        if (user) showDashboard();
    });
    netlifyIdentity.on("login", user => {
        showDashboard();
        netlifyIdentity.close();
    });
    netlifyIdentity.on("logout", () => {
        // Clear cache on logout for security
        localStorage.clear();
        location.reload();
    });
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
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active-tab"));
        
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active-tab");
    };
});

/* ================= DATA LOADING ================= */
async function loadAllSections() {
    // 1. Initial Loaders
    document.querySelectorAll(".tab-content").forEach(el => el.innerHTML = "<p class='loading'>Fetching live FPL data...</p>");

    // 2. Load Core Dependencies
    const bootstrap = await fetchFPL("fpl_bootstrap", "bootstrap-static", 86400000); // 24h
    const league = await fetchFPL("fpl_league", `leagues-classic/${LEAGUE_ID}/standings`);

    if (!league || !bootstrap) {
        alert("Could not load FPL data. Please check Netlify Function logs.");
        return;
    }

    // 3. Render Sections
    renderMembers(league);
    renderCommunityXI(league, bootstrap);
    renderFixtures(bootstrap);
    renderPredictions();
    renderPlanner();
}

/* --- 1. Members Section --- */
function renderMembers(league) {
    const el = document.getElementById("members");
    let html = `<h2>${league.league.name} Standings</h2>`;
    league.standings.results.forEach(m => {
        html += `
            <div class="card">
                <span><strong>${m.rank}.</strong> ${m.player_name} (${m.entry_name})</span>
                <span style="color: var(--fpl-green); font-weight:bold;">${m.total} pts</span>
            </div>`;
    });
    el.innerHTML = html;
}

/* --- 2. Community XI --- */
async function renderCommunityXI(league, bootstrap) {
    const el = document.getElementById("popular");
    const gw = bootstrap.events.find(e => e.is_current).id;
    const playerNames = {};
    bootstrap.elements.forEach(p => playerNames[p.id] = p.web_name);

    const counts = {};
    const topManagers = league.standings.results.slice(0, 5); // Analyze top 5

    for (const m of topManagers) {
        const picks = await fetchFPL(`picks_${m.entry}_${gw}`, `entry/${m.entry}/event/${gw}/picks`);
        if (picks && picks.picks) {
            picks.picks.forEach(p => {
                counts[p.element] = (counts[p.element] || 0) + 1;
            });
        }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 11);
    
    let html = `<h2>Community XI</h2><p class="subtitle">Most owned by your top 5 rivals</p>`;
    sorted.forEach(([id, count]) => {
        const pct = (count / topManagers.length) * 100;
        html += `
            <div class="card">
                <span>${playerNames[id]}</span>
                <span class="percentage-label" style="color: var(--fpl-green)">${pct}%</span>
            </div>`;
    });
    el.innerHTML = html;
}

/* --- 3. Fixture Ticker --- */
async function renderFixtures(bootstrap) {
    const el = document.getElementById("fixtures");
    const fixtures = await fetchFPL("fpl_fixtures", "fixtures?future=1", 3600000);
    const teamMap = {};
    bootstrap.teams.forEach(t => teamMap[t.id] = t.name);

    let html = "<h2>Fixture Ticker</h2>";
    if (fixtures) {
        fixtures.slice(0, 12).forEach(f => {
            html += `
                <div class="card">
                    <span>${teamMap[f.team_h]} vs ${teamMap[f.team_a]}</span>
                    <span class="difficulty-pill ${f.team_h_difficulty <= 2 ? 'easy' : 'hard'}">
                        GW${f.event}
                    </span>
                </div>`;
        });
    }
    el.innerHTML = html;
}

/* --- 4. Predictions --- */
function renderPredictions() {
    document.getElementById("predictions").innerHTML = `
        <h2>Points Predictions</h2>
        <div class="card" style="display:block">
            <p><strong>Estimated GW Average:</strong> 54 pts</p>
            <hr style="border:0; border-top:1px solid #333; margin:10px 0;">
            <p>🎯 <strong>Top Captain:</strong> M. Salah</p>
            <p>🛡️ <strong>Clean Sheet Odds:</strong> Arsenal (54%)</p>
        </div>`;
}

/* --- 5. Transfer Planner --- */
function renderPlanner() {
    document.getElementById("transfers").innerHTML = `
        <h2>Transfer Planner</h2>
        <div class="card" style="display:block">
            <input type="text" placeholder="Player OUT" style="width:100%; padding:10px; margin-bottom:10px; border-radius:4px; border:none;">
            <input type="text" placeholder="Player IN" style="width:100%; padding:10px; margin-bottom:10px; border-radius:4px; border:none;">
            <button class="secondary-btn" style="width:100%; background:var(--fpl-green); color:#000; font-weight:bold; padding:10px; border:none; border-radius:4px; cursor:pointer;">Compare Fixtures</button>
        </div>`;
}
