'use strict';

const db     = require('../config/database');
const bcrypt = require('bcryptjs');

class Admin {

    static async findByEmail(email) {
        const [rows] = await db.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await db.query(
            'SELECT id, name, email, avatar, created_at FROM admins WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] || null;
    }

    static async verifyPassword(plainText, hash) {
        return bcrypt.compare(plainText, hash);
    }

    static async updateProfile(id, { name, email, avatar }) {
        const fields = [];
        const values = [];
        if (name)   { fields.push('name = ?');   values.push(name); }
        if (email)  { fields.push('email = ?');  values.push(email); }
        if (avatar) { fields.push('avatar = ?'); values.push(avatar); }
        if (!fields.length) return false;
        values.push(id);
        await db.query(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);
        return true;
    }

    static async updatePassword(id, newPassword) {
        const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        await db.query('UPDATE admins SET password = ? WHERE id = ?', [hash, id]);
    }

    /**
     * Créer l'admin par défaut si aucun n'existe
     */
    static async createDefault() {
        const [rows] = await db.query('SELECT id FROM admins LIMIT 1');
        if (rows.length > 0) return;

        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@2024', 12);
        await db.query(
            'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
            [process.env.ADMIN_NAME || 'Administrateur', process.env.ADMIN_EMAIL || 'admin@vision4d.cm', hash]
        );
        console.log('✅ Admin par défaut créé:', process.env.ADMIN_EMAIL);
    }
}

module.exports = Admin;
