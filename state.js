/**
 * FFH Re-Engineering: State Management
 * Handles: Transfers, Bank Calculation, and Plan Persistence
 */

const SQUAD_STORAGE_KEY = "ffh_current_draft";
const PLANS_STORAGE_KEY = "ffh_saved_plans";

let gameState = {
    squad: [],       // Current 15 players
    bank: 0.0,       // Money in the bank
    activePlan: 'Default',
    totalValue: 0.0
};

/**
 * Initialize State: Loads the last draft or a blank slate
 */
function initGameState(initialPlayers = []) {
    const saved = localStorage.getItem(SQUAD_STORAGE_KEY);
    if (saved) {
        gameState = JSON.parse(saved);
    } else {
        gameState.squad = initialPlayers;
        gameState.bank = 100.0 - calculateSquadCost(initialPlayers);
    }
    updateMetrics();
}

/**
 * Adds a player to the squad and deducts cost from bank
 */
function addPlayerToDraft(player) {
    if (gameState.squad.length >= 15) return { success: false, msg: "Squad Full" };
    if (gameState.bank < player.price) return { success: false, msg: "Insufficient Funds" };

    gameState.squad.push(player);
    gameState.bank -= player.price;
    
    persistState();
    return { success: true };
}

/**
 * Removes a player and adds their price back to the bank
 */
function removePlayerFromDraft(playerId) {
    const player = gameState.squad.find(p => p.id === playerId);
    if (player) {
        gameState.bank += player.price;
        gameState.squad = gameState.squad.filter(p => p.id !== playerId);
        persistState();
    }
}

/**
 * Saves the current draft into a named Plan (e.g., "No Salah Draft")
 */
function savePlan(planName) {
    const allPlans = JSON.parse(localStorage.getItem(PLANS_STORAGE_KEY)) || {};
    allPlans[planName] = {
        squad: [...gameState.squad],
        bank: gameState.bank,
        timestamp: Date.now()
    };
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(allPlans));
}

function persistState() {
    localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify(gameState));
    updateMetrics(); // Refresh UI totals
}

function calculateSquadCost(squad) {
    return squad.reduce((sum, p) => sum + p.price, 0);
}

function updateMetrics() {
    // Logic to update the "In the Bank" and "Team Value" UI elements
    const bankDisplay = document.getElementById('bank-display');
    if (bankDisplay) bankDisplay.innerText = `£${gameState.bank.toFixed(1)}m`;
}