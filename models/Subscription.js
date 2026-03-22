'use strict';

const db = require('../config/database');

class Subscription {

    /**
     * Créer un abonnement avec ses tranches
     */
    static async create({ user_id, formule_id, nombre_tranches, montant_total, frais_pourcent = 0 }) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // Calcul avec frais
            const montant_avec_frais   = montant_total * (1 + frais_pourcent / 100);
            const montant_par_tranche  = Math.ceil(montant_avec_frais / nombre_tranches);
            const date_fin_prevue      = new Date();
            date_fin_prevue.setDate(date_fin_prevue.getDate() + (nombre_tranches * parseInt(process.env.PAYMENT_DEADLINE_DAYS || 15)));

            // Création de l'abonnement
            const [subResult] = await conn.query(
                `INSERT INTO subscriptions
                 (user_id, formule_id, nombre_tranches, montant_total, montant_par_tranche, date_fin_prevue, statut)
                 VALUES (?, ?, ?, ?, ?, ?, 'en_attente_paiement')`,
                [user_id, formule_id, nombre_tranches, montant_avec_frais, montant_par_tranche, date_fin_prevue]
            );
            const subscription_id = subResult.insertId;

            // Création de chaque tranche
            const now = new Date();
            for (let i = 1; i <= nombre_tranches; i++) {
                const date_limite = new Date(now);
                date_limite.setDate(date_limite.getDate() + (i * parseInt(process.env.PAYMENT_DEADLINE_DAYS || 15)));

                await conn.query(
                    `INSERT INTO installments (subscription_id, user_id, numero_tranche, montant, date_limite)
                     VALUES (?, ?, ?, ?, ?)`,
                    [subscription_id, user_id, i, montant_par_tranche, date_limite]
                );
            }

            await conn.commit();
            return subscription_id;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Abonnement actif d'un utilisateur
     */
    static async findActiveByUser(user_id) {
        const [rows] = await db.query(
            `SELECT s.*, f.nom as formule_nom, f.code as formule_code, f.prix as formule_prix
             FROM subscriptions s
             JOIN formules f ON f.id = s.formule_id
             WHERE s.user_id = ? AND s.statut IN ('en_cours', 'en_attente_paiement')
             ORDER BY s.created_at DESC LIMIT 1`,
            [user_id]
        );
        return rows[0] || null;
    }

    /**
     * Tous les abonnements d'un utilisateur
     */
    static async findByUser(user_id) {
        const [rows] = await db.query(
            `SELECT s.*, f.nom as formule_nom, f.code as formule_code
             FROM subscriptions s
             JOIN formules f ON f.id = s.formule_id
             WHERE s.user_id = ?
             ORDER BY s.created_at DESC`,
            [user_id]
        );
        return rows;
    }

    /**
     * Abonnement complet avec tranches
     */
    static async findByIdWithInstallments(id) {
        const [subRows] = await db.query(
            `SELECT s.*, f.nom as formule_nom, f.code as formule_code,
                    u.nom as user_nom, u.prenom as user_prenom, u.telephone
             FROM subscriptions s
             JOIN formules f ON f.id = s.formule_id
             JOIN users u    ON u.id = s.user_id
             WHERE s.id = ? LIMIT 1`,
            [id]
        );
        if (!subRows[0]) return null;

        const [installments] = await db.query(
            'SELECT * FROM installments WHERE subscription_id = ? ORDER BY numero_tranche',
            [id]
        );

        return { ...subRows[0], installments };
    }

    /**
     * Confirmer l'abonnement après paiement réussi de la 1ère tranche
     */
    static async confirmAfterPayment(subscription_id) {
        await db.query(
            "UPDATE subscriptions SET statut = 'en_cours', tranches_payees = 1 WHERE id = ?",
            [subscription_id]
        );
    }

    /**
     * Annuler/supprimer un abonnement en attente de paiement
     * (paiement annulé ou échoué)
     */
    static async cancelPending(subscription_id) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('DELETE FROM installments WHERE subscription_id = ?', [subscription_id]);
            await conn.query('DELETE FROM subscriptions WHERE id = ? AND statut = ?', [subscription_id, 'en_attente_paiement']);
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Mettre à jour le statut et le nombre de tranches payées
     */
    static async updateProgress(subscription_id, tranches_payees, nombre_tranches) {
        const statut = tranches_payees >= nombre_tranches ? 'complete' : 'en_cours';
        await db.query(
            'UPDATE subscriptions SET tranches_payees = ?, statut = ? WHERE id = ?',
            [tranches_payees, statut, subscription_id]
        );
    }

    /**
     * Liste pour l'admin
     */
    static async findAll({ page = 1, limit = 20, statut = '' } = {}) {
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (statut) {
            where += ' AND s.statut = ?';
            params.push(statut);
        }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM subscriptions s ${where}`, params
        );

        const [rows] = await db.query(
            `SELECT s.*, f.nom as formule_nom,
                    CONCAT(u.prenom, ' ', u.nom) as client_nom, u.telephone
             FROM subscriptions s
             JOIN formules f ON f.id = s.formule_id
             JOIN users u    ON u.id = s.user_id
             ${where}
             ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { subscriptions: rows, total, page, pages: Math.ceil(total / limit) };
    }

    /**
     * Statistiques admin
     */
    static async getStats() {
        const [[stats]] = await db.query(`
            SELECT
                COUNT(*) as total,
                SUM(statut = 'en_cours')  as en_cours,
                SUM(statut = 'complete')  as completes,
                SUM(statut = 'annulee')   as annulees,
                SUM(montant_total)        as revenus_total
            FROM subscriptions
        `);
        return stats;
    }

    /**
     * Annuler un abonnement (client ou admin)
     */
    static async cancel(subscription_id) {
        await db.query(
            "UPDATE subscriptions SET statut = 'annulee' WHERE id = ?",
            [subscription_id]
        );
    }

    /**
     * Supprimer définitivement un abonnement (admin seulement)
     */
    static async deleteById(subscription_id) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('DELETE FROM installments WHERE subscription_id = ?', [subscription_id]);
            await conn.query('DELETE FROM subscriptions WHERE id = ?', [subscription_id]);
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Changer la formule d'un abonnement (admin)
     */
    static async changeFormule(subscription_id, formule_id) {
        const db2 = require('../config/database');
        const [formules] = await db2.query('SELECT * FROM formules WHERE id = ?', [formule_id]);
        if (!formules[0]) throw new Error('Formule introuvable');
        const f = formules[0];
        await db2.query(
            'UPDATE subscriptions SET formule_id = ?, montant_total = ? WHERE id = ?',
            [formule_id, f.prix, subscription_id]
        );
    }

    /**
     * Changer le statut manuellement (admin)
     */
    static async setStatut(subscription_id, statut) {
        await db.query(
            'UPDATE subscriptions SET statut = ? WHERE id = ?',
            [statut, subscription_id]
        );
    }

    /**
     * Réactiver un abonnement annulé/expiré (admin)
     */
    static async reactivate(subscription_id) {
        await db.query(
            "UPDATE subscriptions SET statut = 'en_cours' WHERE id = ?",
            [subscription_id]
        );
    }
}

module.exports = Subscription;
