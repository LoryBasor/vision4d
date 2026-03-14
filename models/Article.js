'use strict';

const db = require('../config/database');

class Article {

    static _slugify(str) {
        return str.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 300);
    }

    static async create({ admin_id, titre, contenu, type, image_url, image_id }) {
        const slug = this._slugify(titre) + '-' + Date.now();
        const [result] = await db.query(
            `INSERT INTO articles (admin_id, titre, slug, contenu, type, image_url, image_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [admin_id, titre, slug, contenu, type || 'article', image_url, image_id]
        );
        return result.insertId;
    }

    static async findAll({ page = 1, limit = 10, type = '', published_only = true } = {}) {
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (published_only) { where += ' AND a.is_published = 1'; }
        if (type) { where += ' AND a.type = ?'; params.push(type); }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM articles a ${where}`, params
        );

        const [rows] = await db.query(
            `SELECT a.*, ad.name as admin_name
             FROM articles a
             JOIN admins ad ON ad.id = a.admin_id
             ${where}
             ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { articles: rows, total, page, pages: Math.ceil(total / limit) };
    }

    static async findBySlug(slug) {
        const [rows] = await db.query(
            `SELECT a.*, ad.name as admin_name
             FROM articles a JOIN admins ad ON ad.id = a.admin_id
             WHERE a.slug = ? AND a.is_published = 1 LIMIT 1`,
            [slug]
        );
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM articles WHERE id = ? LIMIT 1', [id]);
        return rows[0] || null;
    }

    static async update(id, { titre, contenu, type, image_url, image_id, is_published }) {
        const fields = [];
        const values = [];
        if (titre)    { fields.push('titre = ?');    values.push(titre); }
        if (contenu)  { fields.push('contenu = ?');  values.push(contenu); }
        if (type)     { fields.push('type = ?');     values.push(type); }
        if (image_url){ fields.push('image_url = ?');values.push(image_url); }
        if (image_id) { fields.push('image_id = ?'); values.push(image_id); }
        if (is_published !== undefined) {
            fields.push('is_published = ?', 'published_at = ?');
            values.push(is_published ? 1 : 0, is_published ? new Date() : null);
        }
        if (!fields.length) return false;
        values.push(id);
        await db.query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, values);
        return true;
    }

    static async delete(id) {
        await db.query('DELETE FROM articles WHERE id = ?', [id]);
    }

    static async togglePublish(id) {
        await db.query(
            `UPDATE articles
             SET is_published = NOT is_published,
                 published_at = IF(is_published = 0, NOW(), NULL)
             WHERE id = ?`,
            [id]
        );
    }
}

module.exports = Article;
