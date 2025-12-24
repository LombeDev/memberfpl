/**
 * FFH Re-Engineering: API & Cache Layer
 * Handles: CORS bypassing, Rate-limiting, and Data Cleaning
 */

const FPL_BASE = "https://fantasy.premierleague.com/api/bootstrap-static/";
// Note: You must use a CORS proxy to access FPL from a browser.
// Example: https://cors-anywhere.herokuapp.com/
const PROXY = "https://your-proxy-service.com/"; 

const CACHE_KEY = "ffh_fpl_data";
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 Hour

async function fetchFPLData() {
    // 1. Check for valid cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
            console.log("⚡ Serving from Local Cache");
            return data;
        }
    }

    // 2. Fetch fresh data if cache is old or missing
    console.log("🌐 Fetching fresh data from FPL API...");
    try {
        const response = await fetch(PROXY + FPL_BASE);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const rawData = await response.json();
        
        // 3. Clean the data (Save only what we need for the UI)
        const cleanedData = cleanData(rawData);

        // 4. Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: cleanedData
        }));

        return cleanedData;
    } catch (error) {
        console.error("❌ FPL Fetch Error:", error);
        return cached ? JSON.parse(cached).data : null;
    }
}

/**
 * Trims the 1MB+ FPL response into a lean object
 */
function cleanData(raw) {
    return {
        players: raw.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            pos: p.element_type, // 1=GKP, 2=DEF, 3=MID, 4=FWD
            price: p.now_cost / 10,
            status: p.status,
            news: p.news,
            totalPoints: p.total_points,
            chanceNext: p.chance_of_playing_next_round
        })),
        teams: raw.teams.map(t => ({
            id: t.id,
            name: t.name,
            short: t.short_name
        })),
        events: raw.events // Current GW info
    };
}