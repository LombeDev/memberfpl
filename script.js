/* ================= CONFIGURATION ================= */
const LEAGUE_ID = 101712;
const PROXY_URL = "/.netlify/functions/fpl-proxy"; 

/* ================= CACHE ENGINE ================= */
async function fetchFPL(key, path, ttl = 1800000) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() < expiry && data !== null) return data;
    }
    try {
        const res = await fetch(`${PROXY_URL}?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        if (data && !data.error) {
            localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + ttl }));
        }
        return data;
    } catch (err) {
        console.error(`Fetch Error [${path}]:`, err);
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

/* ================= DATA LOADING ================= */
async function loadAllSections() {
    document.querySelectorAll(".tab-content").forEach(el => el.innerHTML = "<div class='loader'>Synchronizing FPL Data...</div>");

    const bootstrap = await fetchFPL("fpl_bootstrap", "bootstrap-static", 86400000);
    const league = await fetchFPL("fpl_league", `leagues-classic/${LEAGUE_ID}/standings`);

    if (league && bootstrap) {
        renderMembers(league);
        renderCommunityXI(league, bootstrap);
        renderFixtures(bootstrap);
        renderPredictions(bootstrap);
        renderPlanner(bootstrap);
    }
}

/* 1. MEMBERS LIST */
function renderMembers(league) {
    const el = document.getElementById("members");
    let html = `<h2>${league.league.name} <span class="badge">Live</span></h2>`;
    html += `<table class="fpl-table">
        <thead><tr><th>Rank</th><th>Manager</th><th>GW</th><th>Total</th></tr></thead>
        <tbody>`;
    league.standings.results.forEach(m => {
        html += `
            <tr>
                <td>${m.rank}</td>
                <td><strong>${m.player_name}</strong><br><small>${m.entry_name}</small></td>
                <td>${m.event_total}</td>
                <td class="txt-green">${m.total}</td>
            </tr>`;
    });
    html += `</tbody></table>`;
    el.innerHTML = html;
}

/* 2. COMMUNITY XI */
async function renderCommunityXI(league, bootstrap) {
    const el = document.getElementById("popular");
    const currentGW = bootstrap.events.find(e => e.is_current)?.id || 1;
    const playerMap = {};
    bootstrap.elements.forEach(p => playerMap[p.id] = { name: p.web_name, status: p.status });

    const counts = {};
    const topManagers = league.standings.results.slice(0, 5);

    for (const m of topManagers) {
        const picksData = await fetchFPL(`picks_${m.entry}_${currentGW}`, `entry/${m.entry}/event/${currentGW}/picks`);
        if (picksData?.picks) {
            picksData.picks.forEach(p => counts[p.element] = (counts[p.element] || 0) + 1);
        }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 11);
    el.innerHTML = `<h2>Consensus XI <small>Top 5 Rivals</small></h2>`;
    sorted.forEach(([id, count]) => {
        const p = playerMap[id];
        const statusIcon = p.status !== 'a' ? '⚠️' : '✅';
        el.innerHTML += `
            <div class="card flex-between">
                <span>${statusIcon} ${p.name}</span>
                <span class="pct-bar" style="--w: ${(count/5)*100}%">${(count/5)*100}%</span>
            </div>`;
    });
}

/* 3. FIXTURE TICKER */
async function renderFixtures(bootstrap) {
    const el = document.getElementById("fixtures");
    const fixtures = await fetchFPL("fpl_fixtures", "fixtures?future=1", 3600000);
    const teams = {};
    bootstrap.teams.forEach(t => teams[t.id] = { name: t.short_name });

    el.innerHTML = "<h2>Upcoming Difficulty</h2>";
    if (fixtures) {
        fixtures.slice(0, 12).forEach(f => {
            const diffColor = f.team_h_difficulty <= 2 ? '#00ff87' : (f.team_h_difficulty >= 4 ? '#ff005a' : '#e1e1e1');
            el.innerHTML += `
                <div class="card flex-between">
                    <span><strong>${teams[f.team_h].name}</strong> vs ${teams[f.team_a].name}</span>
                    <span class="diff-chip" style="background:${diffColor}">GW${f.event}</span>
                </div>`;
        });
    }
}

/* 4. PREDICTIONS & CAPTAINCY POLL */
function renderPredictions(bootstrap) {
    const el = document.getElementById("predictions");
    const userVote = localStorage.getItem("fpl_user_vote");
    
    // Get top form players for the poll
    const candidates = [...bootstrap.elements]
        .sort((a, b) => b.form - a.form)
        .slice(0, 3);

    let html = `
        <h2>Captaincy Poll <small>League Vote</small></h2>
        <div class="card info-card">
            <p style="margin-bottom:15px; color:#888;">Who is your captain for the next Gameweek?</p>
            <div class="poll-container">`;

    candidates.forEach(p => {
        const isSelected = userVote === p.web_name;
        html += `
            <button class="poll-option ${isSelected ? 'selected' : ''}" 
                    onclick="handleVote('${p.web_name}')">
                <span>${p.web_name}</span>
                <span class="vote-check">${isSelected ? '⭐' : ''}</span>
            </button>`;
    });

    html += `</div></div>`;
    el.innerHTML = html;
}

window.handleVote = function(playerName) {
    localStorage.setItem("fpl_user_vote", playerName);
    const bootstrap = JSON.parse(localStorage.getItem("fpl_bootstrap")).data;
    renderPredictions(bootstrap);
};

/* 5. SCOUTING PLANNER */
function renderPlanner(bootstrap) {
    const el = document.getElementById("transfers");
    el.innerHTML = `
        <h2>Scouting Tool</h2>
        <input type="text" id="playerSearch" class="fpl-input" placeholder="Search Player (e.g. Palmer)...">
        <div id="plannerOutput"></div>`;

    document.getElementById("playerSearch").oninput = (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 3) return;
        
        const player = bootstrap.elements.find(p => p.web_name.toLowerCase().includes(query));
        const output = document.getElementById("plannerOutput");
        if (player) {
            const team = bootstrap.teams.find(t => t.id === player.team).name;
            output.innerHTML = `
                <div class="card scout-result" style="display:block">
                    <h3>${player.first_name} ${player.second_name}</h3>
                    <p>Team: ${team} | Price: £${(player.now_cost / 10).toFixed(1)}m</p>
                    <p>Form: ${player.form} | Total Pts: ${player.total_points}</p>
                </div>`;
        }
    };
}
