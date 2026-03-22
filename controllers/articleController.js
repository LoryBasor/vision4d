'use strict';

const Article            = require('../models/Article');
const { uploadImage }    = require('../services/uploadService');

const articleController = {

    // GET /blog
    async showBlog(req, res) {
        try {
            const { page = 1, type = '' } = req.query;
            const { articles, total, pages } = await Article.findAll({
                page: parseInt(page), limit: 9, type, published_only: true,
            });
            res.render('client/blog', {
                title: 'Blog & Actualités — Vision 4D',
                articles, type, total,
                page:  parseInt(page),
                pages,
            });
        } catch (err) {
            console.error('[Article] showBlog:', err);
            res.render('client/error', { title: 'Erreur', message: 'Erreur blog.', code: 500 });
        }
    },

    // GET /blog/:slug
    async showArticle(req, res) {
        try {
            const article = await Article.findBySlug(req.params.slug);
            if (!article) {
                return res.render('client/error', { title: '404', message: 'Article introuvable.', code: 404 });
            }
            res.render('client/article', {
                title: `${article.titre} — Vision 4D`,
                article,
            });
        } catch (err) {
            res.redirect('/blog');
        }
    },

    // GET /admin/articles
    async adminList(req, res) {
        try {
            const { page = 1 } = req.query;
            const { articles, total, pages } = await Article.findAll({
                page: parseInt(page), limit: 15, published_only: false,
            });
            res.render('admin/articles', {
                title: 'Gestion Articles — Admin',
                articles, total, page: parseInt(page), pages,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            console.error('[Article Admin] list:', err);
            res.redirect('/admin/dashboard');
        }
    },

    // GET /admin/articles/nouveau
    showCreateForm(req, res) {
        res.render('admin/article-form', {
            title:   'Nouvel Article — Admin',
            article: null,
            errors:  [],
        });
    },

    // POST /admin/articles/nouveau
    async create(req, res) {
        if (!req.app.locals.verifyCsrf(req, res)) {
            req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
            return res.redirect('/admin/articles');
        }
        try {
            const { titre, contenu, type } = req.body;
            let image_url;

            if (req.file && req.file.buffer) {
                try {
                    image_url = await uploadImage(req.file.buffer, 'articles', req.file.originalname);
                } catch (e) {
                    console.error('[Article] Upload image:', e.message);
                }
            }

            await Article.create({ admin_id: req.admin.id, titre, contenu, type, image_url });
            req.flash('success', 'Article créé avec succès.');
            res.redirect('/admin/articles');
        } catch (err) {
            console.error('[Article Admin] create:', err);
            req.flash('error', 'Erreur lors de la création.');
            res.redirect('/admin/articles/nouveau');
        }
    },

    // GET /admin/articles/:id/modifier
    async showEditForm(req, res) {
        const article = await Article.findById(req.params.id);
        if (!article) return res.redirect('/admin/articles');
        res.render('admin/article-form', { title: 'Modifier Article — Admin', article, errors: [] });
    },

    // POST /admin/articles/:id/modifier
    async update(req, res) {
        if (!req.app.locals.verifyCsrf(req, res)) {
            req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
            return res.redirect('/admin/articles');
        }
        try {
            const { titre, contenu, type } = req.body;
            let image_url;

            if (req.file && req.file.buffer) {
                try {
                    // Récupérer l'ancienne image pour la supprimer sur Cloudinary
                    const existing = await Article.findById(req.params.id);
                    const oldUrl   = existing ? existing.image_url : null;
                    image_url = await uploadImage(req.file.buffer, 'articles', req.file.originalname, oldUrl);
                } catch (e) {
                    console.error('[Article] Upload update:', e.message);
                }
            }

            await Article.update(req.params.id, { titre, contenu, type, image_url });
            req.flash('success', 'Article mis à jour.');
            res.redirect('/admin/articles');
        } catch (err) {
            req.flash('error', 'Erreur lors de la mise à jour.');
            res.redirect('/admin/articles');
        }
    },

    // POST /admin/articles/:id/publier
    async togglePublish(req, res) {
        await Article.togglePublish(req.params.id);
        req.flash('success', 'Statut de publication modifié.');
        res.redirect('/admin/articles');
    },

    // POST /admin/articles/:id/supprimer
    async delete(req, res) {
        await Article.delete(req.params.id);
        req.flash('success', 'Article supprimé.');
        res.redirect('/admin/articles');
    },
};

module.exports = articleController;
