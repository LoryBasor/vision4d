'use strict';

const User                = require('../models/User');
const Subscription        = require('../models/Subscription');
const Installment         = require('../models/Installment');
const db                  = require('../config/database');
const Product             = require('../models/Product');
const Admin               = require('../models/Admin');
const subscriptionService = require('../services/subscriptionService');
const { uploadImage }     = require('../services/uploadService');

const adminController = {
    
    // GET /admin/dashboard
    async dashboard(req, res) {
        try {
            const [
                totalUsers,
                subStats,
                revenue,
                recentPayments,
            ] = await Promise.all([
                User.countActive(),
                Subscription.getStats(),
                Installment.getTotalRevenue(),
                Installment.getRecent(8),
            ]);

            res.render('admin/dashboard', {
                title:   'Dashboard — Admin Vision 4D',
                totalUsers,
                subStats,
                revenue,
                recentPayments,
                admin:   req.admin,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            console.error('[Admin] dashboard:', err);
            res.render('admin/error', { title: 'Erreur', message: 'Erreur dashboard.' });
        }
    },

    // ─── CLIENTS ─────────────────────────────────────────────────────────────

    // GET /admin/clients
    async listClients(req, res) {
        try {
            const { page = 1, search = '' } = req.query;
            const { users, total, pages }   = await User.findAll({
                page: parseInt(page), limit: 20, search,
            });

            res.render('admin/clients', {
                title: 'Clients — Admin',
                users, total, page: parseInt(page), pages, search,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            console.error('[Admin] listClients:', err);
            res.redirect('/admin/dashboard');
        }
    },

    // GET /admin/clients/:id
    async showClient(req, res) {
        try {
            const user          = await User.findById(req.params.id);
            if (!user) return res.redirect('/admin/clients');

            const subscriptions = await Subscription.findByUser(user.id);
            let installments    = [];
            if (subscriptions[0]) {
                installments = await Installment.findBySubscription(subscriptions[0].id);
            }

            res.render('admin/client-detail', {
                title: `${user.prenom} ${user.nom} — Admin`,
                user, subscriptions, installments,
            });
        } catch (err) {
            res.redirect('/admin/clients');
        }
    },

    // ─── ABONNEMENTS ─────────────────────────────────────────────────────────

    // GET /admin/abonnements
    async listSubscriptions(req, res) {
        try {
            const { page = 1, statut = '' } = req.query;
            const { subscriptions, total, pages } = await Subscription.findAll({
                page: parseInt(page), limit: 20, statut,
            });

            res.render('admin/subscriptions', {
                title: 'Abonnements — Admin',
                subscriptions, total, page: parseInt(page), pages, statut,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            res.redirect('/admin/dashboard');
        }
    },

    // GET /admin/abonnements/:id
    async showSubscription(req, res) {
        try {
            const sub = await Subscription.findByIdWithInstallments(req.params.id);
            if (!sub) return res.redirect('/admin/abonnements');

            // Charger les formules pour le sélecteur de changement de formule
            const [formules] = await db.query('SELECT * FROM formules WHERE is_active = 1 ORDER BY prix');

            res.render('admin/subscription-detail', {
                title:   `Abonnement #${sub.id} — Admin`,
                sub,
                formules,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            console.error('[Admin] showSubscription:', err);
            res.redirect('/admin/abonnements');
        }
    },

    // ─── BOUTIQUE (PRODUITS) ──────────────────────────────────────────────────

    // GET /admin/boutique
    async listProducts(req, res) {
        try {
            const { page = 1 } = req.query;
            const { products, total, pages } = await Product.findAll({
                page: parseInt(page), limit: 20,
            });

            res.render('admin/products', {
                title: 'Boutique — Admin',
                products, total, page: parseInt(page), pages,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            res.redirect('/admin/dashboard');
        }
    },

    showProductForm(req, res) {
        res.render('admin/product-form', {
            title:   'Ajouter un produit — Admin',
            product: null,
            errors:  [],
        });
    },

    async createProduct(req, res) {
        if (!req.app.locals.verifyCsrf(req, res)) {
            req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
            return res.redirect('/admin/boutique');
        }
        try {
            const { nom, description, prix, categorie, stock } = req.body;
            let image_url;

            if (req.file && req.file.buffer) {
                try { image_url = await uploadImage(req.file.buffer, 'products', req.file.originalname); }
                catch (e) { console.error('[Admin] Upload produit:', e.message); }
            }

            await Product.create({ nom, description, prix: parseFloat(prix), categorie, stock: parseInt(stock) || 0, image_url });
            req.flash('success', 'Produit ajouté.');
            res.redirect('/admin/boutique');
        } catch (err) {
            console.error('[Admin] createProduct:', err);
            req.flash('error', 'Erreur lors de l\'ajout.');
            res.redirect('/admin/boutique');
        }
    },

    async showEditProduct(req, res) {
        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/admin/boutique');
        res.render('admin/product-form', { title: 'Modifier produit — Admin', product, errors: [] });
    },

    async updateProduct(req, res) {
        if (!req.app.locals.verifyCsrf(req, res)) {
            req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
            return res.redirect('/admin/boutique');
        }
        try {
            const { nom, description, prix, categorie, stock } = req.body;
            let image_url;

            if (req.file && req.file.buffer) {
                try { image_url = await uploadImage(req.file.buffer, 'products', req.file.originalname); }
                catch (e) { console.error('[Admin] Upload produit update:', e.message); }
            }

            await Product.update(req.params.id, { nom, description, prix: parseFloat(prix), categorie, stock: parseInt(stock), image_url });
            req.flash('success', 'Produit mis à jour.');
            res.redirect('/admin/boutique');
        } catch (err) {
            req.flash('error', 'Erreur lors de la mise à jour.');
            res.redirect('/admin/boutique');
        }
    },

    async deleteProduct(req, res) {
        await Product.delete(req.params.id);
        req.flash('success', 'Produit supprimé.');
        res.redirect('/admin/boutique');
    },

    // ─── TARIFS TRANCHES ─────────────────────────────────────────────────────

    async showTarifs(req, res) {
        const tarifs = await subscriptionService.getTarifs();
        res.render('admin/tarifs', {
            title:  'Tarifs des tranches — Admin',
            tarifs,
            success: req.flash('success'),
            error:   req.flash('error'),
        });
    },

    async updateTarifs(req, res) {
        try {
            const { tarifs } = req.body; // Array [{nombre_tranches, frais_pourcent, description}]
            await subscriptionService.updateTarifs(tarifs);
            req.flash('success', 'Tarifs mis à jour avec succès.');
        } catch (err) {
            req.flash('error', 'Erreur lors de la mise à jour des tarifs.');
        }
        res.redirect('/admin/tarifs');
    },

    // ─── PROFIL ADMIN ─────────────────────────────────────────────────────────

    async showProfile(req, res) {
        res.render('admin/profile', {
            title:  'Mon Profil — Admin',
            admin:  req.admin,
            success: req.flash('success'),
            error:   req.flash('error'),
        });
    },

    async updateProfile(req, res) {
        if (!req.app.locals.verifyCsrf(req, res)) {
            req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
            return res.redirect('/admin/profil');
        }
        try {
            const { name, email } = req.body;
            let avatar;

            if (req.file && req.file.buffer) {
                try { avatar = await uploadImage(req.file.buffer, 'admins', req.file.originalname); }
                catch (e) { console.error('[Admin] Upload avatar admin:', e.message); }
            }

            await Admin.updateProfile(req.admin.id, { name, email, avatar });
            req.flash('success', 'Profil mis à jour.');
        } catch (err) {
            req.flash('error', 'Erreur lors de la mise à jour.');
        }
        res.redirect('/admin/profil');
    },

    async updateAdminPassword(req, res) {
        try {
            const { current_password, new_password } = req.body;
            const admin = await Admin.findByEmail(req.admin.email);
            const valid = await Admin.verifyPassword(current_password, admin.password);
            if (!valid) {
                req.flash('error', 'Mot de passe actuel incorrect.');
                return res.redirect('/admin/profil');
            }
            await Admin.updatePassword(req.admin.id, new_password);
            req.flash('success', 'Mot de passe modifié.');
        } catch (err) {
            req.flash('error', 'Erreur lors du changement.');
        }
        res.redirect('/admin/profil');
    },
    // ─── ADMIN — ACTIONS ABONNEMENTS ─────────────────────────────────────────

    // POST /admin/abonnements/:id/changer-statut
    async changeSubscriptionStatut(req, res) {
        try {
            const { statut } = req.body;
            const allowed = ['en_cours', 'complete', 'annulee', 'expiree', 'en_attente_paiement'];
            if (!allowed.includes(statut)) {
                req.flash('error', 'Statut invalide.');
                return res.redirect(`/admin/abonnements/${req.params.id}`);
            }
            await Subscription.setStatut(req.params.id, statut);
            req.flash('success', `Statut mis à jour : ${statut.replace('_',' ')}`);
        } catch (err) {
            console.error('[Admin] changeSubscriptionStatut:', err);
            req.flash('error', 'Erreur lors du changement de statut.');
        }
        res.redirect(`/admin/abonnements/${req.params.id}`);
    },

    // POST /admin/abonnements/:id/changer-formule
    async changeSubscriptionFormule(req, res) {
        try {
            const { formule_id } = req.body;
            const [rows] = await db.query('SELECT * FROM formules WHERE id = ? AND is_active = 1', [formule_id]);
            if (!rows[0]) {
                req.flash('error', 'Formule invalide.');
                return res.redirect(`/admin/abonnements/${req.params.id}`);
            }
            await Subscription.changeFormule(req.params.id, formule_id);
            req.flash('success', `Formule changée vers Canal+ ${rows[0].nom}`);
        } catch (err) {
            console.error('[Admin] changeSubscriptionFormule:', err);
            req.flash('error', 'Erreur lors du changement de formule.');
        }
        res.redirect(`/admin/abonnements/${req.params.id}`);
    },

    // POST /admin/abonnements/:id/supprimer
    async deleteSubscription(req, res) {
        try {
            await Subscription.deleteById(req.params.id);
            req.flash('success', 'Abonnement supprimé définitivement.');
        } catch (err) {
            console.error('[Admin] deleteSubscription:', err);
            req.flash('error', 'Erreur lors de la suppression.');
        }
        res.redirect('/admin/abonnements');
    },

    // ─── ADMIN — GESTION CLIENTS ──────────────────────────────────────────────

    // POST /admin/clients/:id/toggle-active
    async toggleClientActive(req, res) {
        try {
            const newState = await User.toggleActive(req.params.id);
            req.flash('success', `Client ${newState ? 'activé' : 'désactivé'} avec succès.`);
        } catch (err) {
            console.error('[Admin] toggleClientActive:', err);
            req.flash('error', 'Erreur lors du changement de statut du client.');
        }
        res.redirect(`/admin/clients/${req.params.id}`);
    },

    // POST /admin/clients/:id/supprimer-abonnement
    async deleteClientSubscription(req, res) {
        try {
            const { subscription_id } = req.body;
            // Vérifier que l'abonnement appartient bien à ce client
            const sub = await Subscription.findByIdWithInstallments(subscription_id);
            if (!sub || String(sub.user_id) !== String(req.params.id)) {
                req.flash('error', 'Abonnement introuvable pour ce client.');
                return res.redirect(`/admin/clients/${req.params.id}`);
            }
            await Subscription.deleteById(subscription_id);
            req.flash('success', 'Abonnement du client supprimé.');
        } catch (err) {
            console.error('[Admin] deleteClientSubscription:', err);
            req.flash('error', 'Erreur lors de la suppression.');
        }
        res.redirect(`/admin/clients/${req.params.id}`);
    },


    // ─── ADMIN — WHATSAPP ─────────────────────────────────────────────────────

    // GET /admin/whatsapp
    async showWhatsApp(req, res) {
        const whatsapp = require('../services/whatsappService');
        res.render('admin/whatsapp', {
            title:    'WhatsApp — Admin Vision 4D',
            waStatus: whatsapp.getStatus(),
            qrCode:   whatsapp.getQRCode(),
            waError:  whatsapp.getError(),
            success:  req.flash('success'),
            error:    req.flash('error'),
        });
    },

    // POST /admin/whatsapp/restart
    async restartWhatsApp(req, res) {
        try {
            const whatsapp = require('../services/whatsappService');
            whatsapp.initWhatsApp().catch(() => {});
            req.flash('success', 'WhatsApp redémarré. Rechargez dans 10 secondes.');
        } catch (err) {
            req.flash('error', 'Erreur lors du redémarrage: ' + err.message);
        }
        res.redirect('/admin/whatsapp');
    },

    // POST /admin/whatsapp/test
    async testWhatsApp(req, res) {
        try {
            const whatsapp = require('../services/whatsappService');
            const sent = await whatsapp.sendToAdmin(
                '🧪 *Test Vision 4D*\n\nLe service WhatsApp fonctionne correctement ✅\n' +
                new Date().toLocaleString('fr-FR')
            );
            req.flash(sent ? 'success' : 'error',
                sent ? 'Message test envoyé avec succès !' : 'Échec de l\'envoi. Vérifiez la connexion.');
        } catch (err) {
            req.flash('error', 'Erreur: ' + err.message);
        }
        res.redirect('/admin/whatsapp');
    },


};

module.exports = adminController;
