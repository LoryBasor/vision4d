'use strict';

const db = require('../config/database');

class Product {

    static async findAll({ page = 1, limit = 12, categorie = '', search = '' } = {}) {
        const offset = (page - 1) * limit;
        let where = "WHERE is_active = 1";
        const params = [];

        if (categorie) { where += ' AND categorie = ?'; params.push(categorie); }
        if (search)    { where += ' AND nom LIKE ?'; params.push(`%${search}%`); }

        const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM products ${where}`, params);

        const [rows] = await db.query(
            `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { products: rows, total, page, pages: Math.ceil(total / limit) };
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
        return rows[0] || null;
    }

    static async create({ nom, description, prix, categorie, stock, image_url, image_id }) {
        const [result] = await db.query(
            'INSERT INTO products (nom, description, prix, categorie, stock, image_url, image_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nom, description, prix, categorie || 'general', stock || 0, image_url, image_id]
        );
        return result.insertId;
    }

    static async update(id, { nom, description, prix, categorie, stock, image_url, image_id }) {
        const fields = [];
        const values = [];
        if (nom)         { fields.push('nom = ?');         values.push(nom); }
        if (description) { fields.push('description = ?'); values.push(description); }
        if (prix)        { fields.push('prix = ?');        values.push(prix); }
        if (categorie)   { fields.push('categorie = ?');   values.push(categorie); }
        if (stock !== undefined) { fields.push('stock = ?'); values.push(stock); }
        if (image_url)   { fields.push('image_url = ?');   values.push(image_url); }
        if (image_id)    { fields.push('image_id = ?');    values.push(image_id); }

        if (!fields.length) return false;
        values.push(id);
        await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
        return true;
    }

    static async delete(id) {
        await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    }

    static async getCategories() {
        const [rows] = await db.query(
            'SELECT DISTINCT categorie FROM products WHERE is_active = 1 ORDER BY categorie'
        );
        return rows.map(r => r.categorie);
    }
}

module.exports = Product;
