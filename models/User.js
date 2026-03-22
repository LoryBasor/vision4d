'use strict';

const db     = require('../config/database');
const bcrypt = require('bcryptjs');

class User {

    /**
     * Créer un nouvel utilisateur
     */
    static async create({ nom, prenom, email, telephone, password }) {
        const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        const [result] = await db.query(
            `INSERT INTO users (nom, prenom, email, telephone, password)
             VALUES (?, ?, ?, ?, ?)`,
            [nom, prenom, email, telephone, hash]
        );
        return result.insertId;
    }

    /**
     * Trouver un utilisateur par email
     */
    static async findByEmail(email) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
            [email]
        );
        return rows[0] || null;
    }

    /**
     * Trouver un utilisateur par ID
     */
    static async findById(id) {
        const [rows] = await db.query(
            'SELECT id, nom, prenom, email, telephone, numero_decodeur, avatar, is_active, created_at FROM users WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Mettre à jour le profil utilisateur
     */
    static async updateProfile(id, { nom, prenom, telephone, avatar }) {
        const fields = [];
        const values = [];

        if (nom)       { fields.push('nom = ?');       values.push(nom); }
        if (prenom)    { fields.push('prenom = ?');    values.push(prenom); }
        if (telephone) { fields.push('telephone = ?'); values.push(telephone); }
        if (avatar)    { fields.push('avatar = ?');    values.push(avatar); }

        if (!fields.length) return false;

        values.push(id);
        await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        return true;
    }

    /**
     * Mettre à jour le mot de passe
     */
    static async updatePassword(id, newPassword) {
        const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, id]);
    }

    /**
     * Enregistrer le numéro de décodeur
     */
    static async setDecodeur(id, numero_decodeur) {
        await db.query('UPDATE users SET numero_decodeur = ? WHERE id = ?', [numero_decodeur, id]);
    }

    /**
     * Vérifier le mot de passe
     */
    static async verifyPassword(plainText, hash) {
        return bcrypt.compare(plainText, hash);
    }

    /**
     * Lister tous les utilisateurs (admin)
     */
    static async findAll({ page = 1, limit = 20, search = '' } = {}) {
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            where += ' AND (nom LIKE ? OR prenom LIKE ? OR email LIKE ? OR telephone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM users ${where}`,
            params
        );

        const [rows] = await db.query(
            `SELECT id, nom, prenom, email, telephone, numero_decodeur, is_active, created_at
             FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { users: rows, total, page, limit, pages: Math.ceil(total / limit) };
    }

    /**
     * Statistiques rapides (admin dashboard)
     */
    static async countActive() {
        const [[row]] = await db.query('SELECT COUNT(*) as total FROM users WHERE is_active = 1');
        return row.total;
    }

    /**
     * Activer ou désactiver un utilisateur (admin)
     */
    static async toggleActive(id) {
        await db.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
        const [rows] = await db.query('SELECT is_active FROM users WHERE id = ?', [id]);
        return rows[0] ? rows[0].is_active : null;
    }

    /**
     * Forcer le statut actif d'un utilisateur
     */
    static async setActive(id, is_active) {
        await db.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    }
}

module.exports = User;
