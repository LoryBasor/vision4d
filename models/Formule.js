'use strict';

const db = require('../config/database');

class Formule {

    static async findAll() {
        const [rows] = await db.query(
            'SELECT * FROM formules ORDER BY prix ASC'
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.query(
            'SELECT * FROM formules WHERE id = ? LIMIT 1', [id]
        );
        return rows[0] || null;
    }

    static async findByCode(code) {
        const [rows] = await db.query(
            'SELECT * FROM formules WHERE code = ? LIMIT 1', [code]
        );
        return rows[0] || null;
    }

    /**
     * Créer une nouvelle formule
     */
    static async create({ nom, code, prix, description }) {
        // Générer un code automatiquement si non fourni
        const autoCode = code
            ? code.trim().toUpperCase().replace(/\s+/g, '_')
            : nom.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

        const [result] = await db.query(
            `INSERT INTO formules (nom, code, prix, description, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [nom.trim(), autoCode, parseFloat(prix), description || null]
        );
        return result.insertId;
    }

    /**
     * Modifier une formule existante
     */
    static async update(id, { nom, code, prix, description, is_active }) {
        const autoCode = code
            ? code.trim().toUpperCase().replace(/\s+/g, '_')
            : null;

        const fields = [];
        const values = [];

        if (nom !== undefined)        { fields.push('nom = ?');        values.push(nom.trim()); }
        if (autoCode !== null)        { fields.push('code = ?');       values.push(autoCode); }
        if (prix !== undefined)       { fields.push('prix = ?');       values.push(parseFloat(prix)); }
        if (description !== undefined){ fields.push('description = ?');values.push(description || null); }
        if (is_active !== undefined)  { fields.push('is_active = ?');  values.push(is_active ? 1 : 0); }

        if (fields.length === 0) return;
        values.push(id);

        await db.query(
            `UPDATE formules SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    /**
     * Activer / désactiver une formule (toggle)
     */
    static async toggleActive(id) {
        await db.query(
            'UPDATE formules SET is_active = NOT is_active WHERE id = ?', [id]
        );
        const [rows] = await db.query(
            'SELECT is_active FROM formules WHERE id = ?', [id]
        );
        return rows[0] ? rows[0].is_active : null;
    }

    /**
     * Supprimer une formule
     * Vérifie qu'aucun abonnement actif ne l'utilise
     */
    static async delete(id) {
        // Vérifier les abonnements actifs sur cette formule
        const [rows] = await db.query(
            `SELECT COUNT(*) as nb FROM subscriptions
             WHERE formule_id = ? AND statut IN ('en_cours','en_attente_paiement')`,
            [id]
        );
        if (rows[0].nb > 0) {
            throw new Error(`Impossible de supprimer : ${rows[0].nb} abonnement(s) actif(s) utilisent cette formule.`);
        }
        await db.query('DELETE FROM formules WHERE id = ?', [id]);
    }

    /**
     * Compter les abonnements par formule (stats)
     */
    static async countSubscriptions(id) {
        const [rows] = await db.query(
            `SELECT
                SUM(statut = 'en_cours')            as actifs,
                SUM(statut = 'complete')            as completes,
                SUM(statut = 'en_attente_paiement') as en_attente,
                COUNT(*)                            as total
             FROM subscriptions WHERE formule_id = ?`,
            [id]
        );
        return rows[0] || { actifs: 0, completes: 0, en_attente: 0, total: 0 };
    }
}

module.exports = Formule;
