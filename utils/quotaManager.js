// utils/quotaManager.js
const moment = require('moment');
const User = require('../models/User');

// 🔹 Définition des quotas
const DAILY_QUOTA = {
    free: 5,
    basic: 5,
    premium: 10
};

const PAID_QUOTA = {
    basic: 20,
    premium: 50
};

// 🔹 Coût des modèles payants
const MODEL_COST = {
    'claude-opus-4': 6,
    'claude-sonnet-4': 3,
    'deepseek-reasoner': 1,
    'deepseek-chat': 1,
    default: 1
};

/**
 * Vérifie et réinitialise les générations deepseek gratuites si nécessaire
 */
async function checkAndResetFreeDeepSeek(user) {
    const oneWeekAgo = moment().subtract(1, 'week');
    
    if (!user.lastFreeDeepSeekReset || moment(user.lastFreeDeepSeekReset).isBefore(oneWeekAgo)) {
        user.freeDeepSeekGenerations = 3;
        user.lastFreeDeepSeekReset = new Date();
        await user.save();
        console.log(`🔄 Reset des générations deepseek gratuites pour ${user.username}`);
    }
    
    return user;
}

/**
 * Vérifie si l'utilisateur peut utiliser deepseek-chat gratuitement
 */
function canUseFreeDeepSeek(user, model) {
    return model === 'deepseek-chat' && 
           user.subscription.type === 'free' && 
           user.freeDeepSeekGenerations > 0;
}

/**
 * Vérifie si l'utilisateur a assez de quota pour générer
 */
async function checkQuota(userId, isPaidRequest = false, model = 'default') {
    const user = await User.findById(userId);
    if (!user) return { user: null, error: "Utilisateur introuvable" };

    const today = moment().startOf('day');

    // 🔹 Reset daily si nouveau jour
    if (!user.lastReset || moment(user.lastReset).isBefore(today)) {
        user.dailyGenerations = 0; 
        user.lastReset = new Date();
    }

    // 🔹 Vérification et reset des générations deepseek gratuites
    await checkAndResetFreeDeepSeek(user);

    // 🔹 CAS SPÉCIAL: deepseek-chat gratuit pour les free users
    if (model === 'deepseek-chat' && user.subscription.type === 'free') {
        if (user.freeDeepSeekGenerations <= 0) {
            const nextReset = moment(user.lastFreeDeepSeekReset).add(1, 'week');
            return { 
                user, 
                error: `Quota deepseek-chat gratuit épuisé. Prochain reset: ${nextReset.fromNow()}` 
            };
        }
        // Autoriser la génération gratuite
        return { user, error: null };
    }

    // 🔹 Vérification quota journalier (gratuit)
    if (!isPaidRequest) {
        const dailyLimit = DAILY_QUOTA[user.subscription.type] || 5;
        if (user.dailyGenerations >= dailyLimit) {
            return { user, error: `Quota journalier atteint (${dailyLimit})` };
        }
        return { user, error: null };
    }

    // 🔹 Vérification quota payant
    const cost = MODEL_COST[model] || MODEL_COST.default;
    if (user.subscription.type === 'free') {
        return { user, error: "Compte gratuit: pas de quota payant disponible" };
    }

    const paidLimit = PAID_QUOTA[user.subscription.type] || 0;
    if (user.paidGenerations < cost) {
        return { user, error: `Quota payant insuffisant (${cost} nécessaire)` };
    }

    return { user, error: null };
}

/**
 * Applique la génération réussie sur l'utilisateur
 */
async function applyQuota(userId, isPaidRequest = false, model = 'default') {
    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    // 🔹 CAS SPÉCIAL: Utilisation de deepseek-chat gratuit
    if (model === 'deepseek-chat' && user.subscription.type === 'free') {
        user.freeDeepSeekGenerations -= 1;
        if (user.freeDeepSeekGenerations < 0) user.freeDeepSeekGenerations = 0;
        console.log(`🔹 deepseek-chat gratuit utilisé. Restant: ${user.freeDeepSeekGenerations}/3`);
    }
    // 🔹 Décrément payant si applicable
    else if (isPaidRequest) {
        const cost = MODEL_COST[model] || MODEL_COST.default;
        user.paidGenerations -= cost;
        if (user.paidGenerations < 0) user.paidGenerations = 0;
    } else {
        // 🔹 Incrément journalier gratuit
        user.dailyGenerations += 1;
    }

    await user.save();
    return user;
}

/**
 * Sauvegarde une génération dans l'historique
 */
async function saveGeneration(userId, generationData) {
    const user = await User.findById(userId);
    if (!user) return;

    // Ajouter la nouvelle génération
    user.recentGenerations.unshift({
        timestamp: new Date(),
        model: generationData.model,
        type: generationData.type,
        typeSection: generationData.typeSection,
        data: generationData.data,
        requestId: generationData.requestId
    });

    // Garder seulement les 5 dernières générations
    if (user.recentGenerations.length > 5) {
        user.recentGenerations = user.recentGenerations.slice(0, 5);
    }

    await user.save();
}

/**
 * Récupère l'historique des générations
 */
async function getRecentGenerations(userId) {
    const user = await User.findById(userId);
    return user ? user.recentGenerations : [];
}

module.exports = { 
    checkQuota, 
    applyQuota, 
    saveGeneration, 
    getRecentGenerations,
    canUseFreeDeepSeek,
    checkAndResetFreeDeepSeek
};