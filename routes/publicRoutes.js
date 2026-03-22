'use strict';

const express       = require('express');
const router        = express.Router();
const Article       = require('../models/Article');
const Product       = require('../models/Product');
const articleCtrl   = require('../controllers/articleController');
const productCtrl   = require('../controllers/productController');
const subCtrl       = require('../controllers/subscriptionController');

// Page d'accueil
router.get('/', async (req, res) => {
    try {
        const [
            { articles: promotions },
            { articles: actualites },
            { products },
        ] = await Promise.all([
            Article.findAll({ limit: 3, type: 'promotion',  published_only: true }),
            Article.findAll({ limit: 4, type: 'actualite',  published_only: true }),
            Product.findAll({ limit: 6 }),
        ]);

        res.render('client/home', {
            title:    'Vision 4D — Abonnement Canal+ en tranches',
            promotions,
            actualites,
            products,
            user:     res.locals.user || null,
            success:  req.flash('success'),
            error:    req.flash('error'),
        });
    } catch (err) {
        console.error('[Home]', err);
        res.render('client/home', {
            title: 'Vision 4D', promotions: [], actualites: [], products: [], user: null,
            success: [], error: [],
        });
    }
});

// Blog
router.get('/blog',        articleCtrl.showBlog);
router.get('/blog/:slug',  articleCtrl.showArticle);

// Boutique (publique, achat nécessite auth)
router.get('/boutique',     productCtrl.showShop);
router.get('/boutique/:id', productCtrl.showProduct);

// ─── RETOUR PAIEMENT MONETBIL ────────────────────────────────────────────────
// Cette route est PUBLIQUE — pas besoin d'être connecté.
// Monetbil redirige ici après paiement (succès, annulation ou échec).
// L'utilisateur peut arriver sans session active.
router.get('/payment/return',        subCtrl.paymentReturn);
router.get('/payment/return-order',  productCtrl.orderReturn);

module.exports = router;
