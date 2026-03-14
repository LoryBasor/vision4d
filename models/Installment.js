'use strict';

const db = require('../config/database');

class Installment {

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM installments WHERE id = ? LIMIT 1', [id]);
        return rows[0] || null;
    }

    static async findNextPending(subscription_id) {
        const [rows] = await db.query(
            `SELECT * FROM installments
             WHERE subscription_id = ? AND statut = 'en_attente'
             ORDER BY numero_tranche ASC LIMIT 1`,
            [subscription_id]
        );
        return rows[0] || null;
    }

    static async findBySubscription(subscription_id) {
        const [rows] = await db.query(
            'SELECT * FROM installments WHERE subscription_id = ? ORDER BY numero_tranche',
            [subscription_id]
        );
        return rows;
    }

    static async markPaid(id, { transaction_id, payment_ref }) {
        await db.query(
            `UPDATE installments
             SET statut = 'paye', date_paiement = NOW(), transaction_id = ?, payment_ref = ?
             WHERE id = ?`,
            [transaction_id, payment_ref, id]
        );
    }

    static async setPaymentToken(id, token) {
        await db.query('UPDATE installments SET payment_token = ? WHERE id = ?', [token, id]);
    }

    static async findByToken(token) {
        const [rows] = await db.query(
            'SELECT * FROM installments WHERE payment_token = ? LIMIT 1',
            [token]
        );
        return rows[0] || null;
    }

    /**
     * Expirer les tranches dont la date limite est dépassée
     */
    static async expireOverdue() {
        const [result] = await db.query(
            `UPDATE installments
             SET statut = 'expire'
             WHERE statut = 'en_attente' AND date_limite < NOW()`
        );
        return result.affectedRows;
    }

    /**
     * Paiements récents (admin dashboard)
     */
    static async getRecent(limit = 10) {
        const [rows] = await db.query(
            `SELECT i.*, s.formule_id,
                    f.nom as formule_nom,
                    CONCAT(u.prenom, ' ', u.nom) as client_nom,
                    u.telephone
             FROM installments i
             JOIN subscriptions s ON s.id = i.subscription_id
             JOIN formules f      ON f.id = s.formule_id
             JOIN users u         ON u.id = i.user_id
             WHERE i.statut = 'paye'
             ORDER BY i.date_paiement DESC LIMIT ?`,
            [limit]
        );
        return rows;
    }

    static async getTotalRevenue() {
        const [[row]] = await db.query(
            `SELECT COALESCE(SUM(montant), 0) as total
             FROM installments WHERE statut = 'paye'`
        );
        return row.total;
    }
}

module.exports = Installment;
