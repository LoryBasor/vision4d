'use strict';

const { v4: uuidv4 }  = require('uuid');
const Product         = require('../models/Product');
const cloudinary      = require('../config/cloudinary');
const monetbilService = require('../services/monetbilService');
const whatsapp        = require('../services/whatsappService');
const db              = require('../config/database');

const productController = {

    // GET /boutique
    async showShop(req, res) {
        try {
            const { page = 1, categorie = '', search = '' } = req.query;
            const { products, total, pages } = await Product.findAll({
                page: parseInt(page), limit: 12, categorie, search,
            });
            const categories = await Product.getCategories();

            res.render('client/shop', {
                title:      'Boutique — Vision 4D',
                products,
                categories,
                categorie,
                search,
                total,
                page:       parseInt(page),
                pages,
                user:       res.locals.user || null,
            });
        } catch (err) {
            console.error('[Product] showShop:', err);
            res.render('client/error', { title: 'Erreur', message: 'Erreur boutique.', code: 500 });
        }
    },

    // GET /boutique/:id
    async showProduct(req, res) {
        try {
            const product = await Product.findById(req.params.id);
            if (!product || !product.is_active) {
                return res.render('client/error', { title: '404', message: 'Produit introuvable.', code: 404 });
            }
            res.render('client/product', {
                title: `${product.nom} — Vision 4D`,
                product,
                user:  res.locals.user || null,
            });
        } catch (err) {
            res.redirect('/boutique');
        }
    },

    // POST /boutique/:id/acheter
    async buyProduct(req, res) {
        try {
            const product = await Product.findById(req.params.id);
            if (!product || !product.is_active) {
                req.flash('error', 'Produit introuvable.');
                return res.redirect('/boutique');
            }

            const user     = req.user;
            const payRef   = `V4D-ORDER-${uuidv4().slice(0, 10).toUpperCase()}`;

            // Créer la commande en attente
            await db.query(
                'INSERT INTO orders (user_id, product_id, montant_total, statut, payment_token) VALUES (?, ?, ?, ?, ?)',
                [user.id, product.id, product.prix, 'en_attente', payRef]
            );

            // Notifier l'admin
            const msg = whatsapp.buildOrderMessage({
                client_nom:  `${user.prenom} ${user.nom}`,
                product_nom: product.nom,
                montant:     product.prix,
                telephone:   user.telephone,
            });
            await whatsapp.sendToAdmin(msg);

            // Initier paiement (Widget API v2.1)
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const paymentUrl = await monetbilService.initiatePayment({
                amount:      product.prix,
                phone:       user.telephone,
                item_ref:    payRef,
                payment_ref: payRef,
                first_name:  user.prenom,
                last_name:   user.nom,
                user:        String(user.id),
                notify_url:  appUrl + '/payment/notify-order',
                return_url:  appUrl + '/payment/return-order',
            });

            res.redirect(paymentUrl);
        } catch (err) {
            console.error('[Product] buyProduct:', err);
            req.flash('error', 'Erreur lors de l\'achat.');
            res.redirect('/boutique');
        }
    },

    // POST /payment/notify-order — Webhook commandes boutique
    async orderNotify(req, res) {
        try {
            // Répondre immédiatement
            res.sendStatus(200);

            const remoteAddr = req.ip || req.connection.remoteAddress;
            const body       = req.body;

            // Valider la notification
            const validation = monetbilService.validateNotification(body, remoteAddr);
            if (!validation.valid) {
                console.warn(`[Monetbil Order] Notification rejetée : ${validation.reason}`);
                return;
            }

            // Seul "success" valide la commande
            if (!monetbilService.isSuccess(body.status)) {
                console.log(`[Monetbil Order] Statut non réussi : ${body.status}`);
                return;
            }

            const ref = body.item_ref || body.payment_ref;
            await db.query(
                `UPDATE orders
                 SET statut = 'paye', transaction_id = ?
                 WHERE payment_token = ? AND statut = 'en_attente'`,
                [body.transaction_uuid || body.transaction_id, ref]
            );

            console.log(`[Monetbil Order] ✅ Commande payée — ref: ${ref}`);

        } catch (err) {
            console.error('[Order] notify error:', err.message);
        }
    },

    // GET /payment/return-order — Retour paiement boutique
    // Route publique — Monetbil redirige ici après paiement d'un produit
    async orderReturn(req, res) {
        try {
            const { status, payment_ref } = req.query;
            const success = require('../services/monetbilService').isSuccess(status);
            const whatsapp = require('../services/whatsappService');
            const user = req.user || null;

            const waMsg = "Bonjour, je viens d'acheter un produit Vision 4D."
                + (user ? '\nNom: ' + user.prenom + ' ' + user.nom : '')
                + '\nRéf: ' + (payment_ref || 'N/A');

            const waLink = whatsapp.getAdminWhatsAppLink(waMsg);

            res.render('client/payment-return', {
                title:   success ? 'Achat confirmé — Vision 4D' : 'Paiement échoué — Vision 4D',
                success,
                waLink,
                user,
            });
        } catch (err) {
            console.error('[Product] orderReturn:', err);
            res.redirect('/boutique');
        }
    },
};

module.exports = productController;
