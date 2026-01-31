const express = require('express');
const { getRecentGenerations, checkAndResetFreeDeepSeek } = require('../utils/quotaManager');
const decodeToken = require('../utils/verifyToken');
const User = require('../models/User');
const moment = require('moment');

// Route pour récupérer les 5 dernières générations + quotas complets avec reset automatique
exports.getUserStats= async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Token manquant" });

        const userId = decodeToken(token);
        
        // Récupérer et mettre à jour l'utilisateur (reset si nécessaire)
        let user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

        // Appliquer les reset si nécessaire
        user = await checkAndResetFreeDeepSeek(user);
        
        // Reset quotidien si nécessaire
        const today = moment().startOf('day');
        if (!user.lastReset || moment(user.lastReset).isBefore(today)) {
            user.dailyGenerations = 0;
            user.lastReset = new Date();
            await user.save();
        }

        // Calculer les quotas
        const dailyQuotas = {
            free: 5,
            basic: 5,
            premium: 10
        };

        const paidQuotas = {
            free: 0,
            basic: 20,
            premium: 50
        };

        const dailyLimit = dailyQuotas[user.subscription.type] || 5;
        const paidLimit = paidQuotas[user.subscription.type] || 0;
        
        // Calculer les reset times
        const nextDailyReset = moment().endOf('day').toDate();
        const nextDeepSeekReset = user.lastFreeDeepSeekReset ? 
            moment(user.lastFreeDeepSeekReset).add(1, 'week').toDate() : null;

        // Préparer la réponse complète
        const response = {
            user: {
                username: user.username,
                email: user.email,
                subscription: {
                    type: user.subscription.type,
                    status: user.subscription.status,
                    startDate: user.subscription.startDate,
                    endDate: user.subscription.endDate
                },
                createdAt: user.createdAt
            },
            quotas: {
                daily: {
                    used: user.dailyGenerations,
                    limit: dailyLimit,
                    remaining: Math.max(0, dailyLimit - user.dailyGenerations),
                    resetTime: nextDailyReset,
                    resetIn: moment(nextDailyReset).fromNow()
                },
                paid: {
                    used: user.paidUsed || 0,
                    limit: paidLimit,
                    remaining: Math.max(0, paidLimit - (user.paidUsed || 0)),
                    resetTime: user.subscription.endDate || null,
                    resetIn: user.subscription.endDate ? moment(user.subscription.endDate).fromNow() : 'Jamais'
                },
                freeDeepSeek: {
                    used: 3 - user.freeDeepSeekGenerations,
                    limit: 3,
                    remaining: user.freeDeepSeekGenerations,
                    resetTime: nextDeepSeekReset,
                    resetIn: nextDeepSeekReset ? moment(nextDeepSeekReset).fromNow() : 'Inconnu'
                }
            },
            recentGenerations: user.recentGenerations || [],
            summary: {
                canGenerateFree: user.dailyGenerations < dailyLimit,
                canGeneratePaid: user.subscription.type !== 'free' && (user.paidUsed || 0) < paidLimit,
                canUseDeepSeekFree: user.freeDeepSeekGenerations > 0,
                subscriptionStatus: user.subscription.status,
                totalGenerations: (user.recentGenerations || []).length,
                isPremium: user.subscription.type === 'premium',
                isBasic: user.subscription.type === 'basic',
                isFree: user.subscription.type === 'free'
            },
            timestamps: {
                lastReset: user.lastReset,
                lastDeepSeekReset: user.lastFreeDeepSeekReset,
                serverTime: new Date()
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Erreur récupération stats utilisateur:', error);
        res.status(500).json({ error: "Erreur serveur lors de la récupération des statistiques" });
    }
};
