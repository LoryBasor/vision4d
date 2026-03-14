'use strict';

const db           = require('../config/database');
const Subscription = require('../models/Subscription');
const Installment  = require('../models/Installment');

const subscriptionService = {

    /**
     * Récupérer les tarifs de tranches depuis la BDD
     */
    async getTarifs() {
        const [rows] = await db.query('SELECT * FROM tarif_tranches ORDER BY nombre_tranches');
        return rows;
    },

    /**
     * Récupérer toutes les formules actives
     */
    async getFormules() {
        const [rows] = await db.query('SELECT * FROM formules WHERE is_active = 1 ORDER BY prix');
        return rows;
    },

    /**
     * Calculer le montant par tranche avec les frais
     */
    async calculateInstallment(montant_total, nombre_tranches) {
        const [rows] = await db.query(
            'SELECT frais_pourcent FROM tarif_tranches WHERE nombre_tranches = ?',
            [nombre_tranches]
        );
        const frais_pourcent = rows[0] ? rows[0].frais_pourcent : 0;
        const montant_avec_frais  = montant_total * (1 + frais_pourcent / 100);
        const montant_par_tranche = Math.ceil(montant_avec_frais / nombre_tranches);

        return {
            montant_total,
            frais_pourcent,
            montant_avec_frais,
            montant_par_tranche,
            nombre_tranches,
        };
    },

    /**
     * Vérifier si l'utilisateur a un abonnement actif
     */
    async hasActiveSubscription(user_id) {
        const sub = await Subscription.findActiveByUser(user_id);
        return !!sub;
    },

    /**
     * Expirer les tranches en retard (cron job)
     */
    async expireOverdue() {
        const count = await Installment.expireOverdue();
        if (count > 0) {
            // Mettre à jour les abonnements concernés
            await db.query(`
                UPDATE subscriptions SET statut = 'expiree'
                WHERE statut = 'en_cours'
                AND id IN (
                    SELECT DISTINCT subscription_id FROM installments
                    WHERE statut = 'expire'
                )
            `);
            console.log(`[CRON] ${count} tranche(s) expirée(s)`);
        }
        return count;
    },

    /**
     * Mettre à jour les tarifs (admin)
     */
    async updateTarifs(tarifs) {
        for (const t of tarifs) {
            await db.query(
                'UPDATE tarif_tranches SET frais_pourcent = ?, description = ? WHERE nombre_tranches = ?',
                [t.frais_pourcent, t.description, t.nombre_tranches]
            );
        }
    },
};

module.exports = subscriptionService;
