'use strict';

const User                = require('../models/User');
const Formule             = require('../models/Formule');
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
                try {
                    // Récupérer l'ancienne image pour la supprimer
                    const existing = await Product.findById(req.params.id);
                    const oldUrl   = existing ? existing.image_url : null;
                    image_url = await uploadImage(req.file.buffer, 'products', req.file.originalname, oldUrl);
                }
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

    // ─── FORMULES CANAL+ ──────────────────────────────────────────────────────

    async listFormules(req, res) {
        try {
            const Formule  = require('../models/Formule');
            const formules = await Formule.findAll();
            for (const f of formules) {
                f.stats = await Formule.countSubscriptions(f.id);
            }
            res.render('admin/formules', {
                title:   'Formules Canal+ — Admin',
                formules,
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            console.error('[Admin] listFormules:', err);
            req.flash('error', 'Erreur chargement formules.');
            res.redirect('/admin/dashboard');
        }
    },

    showCreateFormule(req, res) {
        res.render('admin/formule-form', {
            title:   'Nouvelle formule — Admin',
            formule: null,
            errors:  [],
            success: [],
            error:   [],
        });
    },

    async createFormule(req, res) {
        try {
            const Formule = require('../models/Formule');
            const { nom, code, prix, description } = req.body;
            if (!nom || !prix) {
                return res.render('admin/formule-form', {
                    title:   'Nouvelle formule — Admin',
                    formule: req.body,
                    errors:  [{ msg: 'Le nom et le prix sont requis.' }],
                    success: [], error: [],
                });
            }
            await Formule.create({ nom, code, prix, description });
            req.flash('success', `Formule "${nom}" créée avec succès.`);
            res.redirect('/admin/formules');
        } catch (err) {
            console.error('[Admin] createFormule:', err);
            const msg = err.message.includes('Duplicate')
                ? 'Ce code formule existe déjà.'
                : "Erreur lors de la création.";
            res.render('admin/formule-form', {
                title: 'Nouvelle formule — Admin', formule: req.body,
                errors: [{ msg }], success: [], error: [],
            });
        }
    },

    async showEditFormule(req, res) {
        try {
            const Formule = require('../models/Formule');
            const formule = await Formule.findById(req.params.id);
            if (!formule) {
                req.flash('error', 'Formule introuvable.');
                return res.redirect('/admin/formules');
            }
            formule.stats = await Formule.countSubscriptions(formule.id);
            res.render('admin/formule-form', {
                title:   `Modifier ${formule.nom} — Admin`,
                formule,
                errors:  [],
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            req.flash('error', 'Erreur chargement.');
            res.redirect('/admin/formules');
        }
    },

    async updateFormule(req, res) {
        try {
            const Formule = require('../models/Formule');
            const { nom, code, prix, description } = req.body;
            await Formule.update(req.params.id, { nom, code, prix, description });
            req.flash('success', `Formule "${nom}" mise à jour.`);
            res.redirect('/admin/formules');
        } catch (err) {
            console.error('[Admin] updateFormule:', err);
            const msg = err.message.includes('Duplicate')
                ? 'Ce code formule existe déjà.'
                : "Erreur lors de la mise à jour.";
            req.flash('error', msg);
            res.redirect(`/admin/formules/${req.params.id}/modifier`);
        }
    },

    async toggleFormule(req, res) {
        try {
            const Formule  = require('../models/Formule');
            const newState = await Formule.toggleActive(req.params.id);
            req.flash('success', `Formule ${newState ? 'activée' : 'désactivée'}.`);
        } catch (err) {
            req.flash('error', "Erreur lors du changement de statut.");
        }
        res.redirect('/admin/formules');
    },

    async deleteFormule(req, res) {
        try {
            const Formule = require('../models/Formule');
            await Formule.delete(req.params.id);
            req.flash('success', 'Formule supprimée.');
        } catch (err) {
            req.flash('error', err.message || "Erreur lors de la suppression.");
        }
        res.redirect('/admin/formules');
    },

    async updateFormulePrix(req, res) {
        try {
            const Formule = require('../models/Formule');
            const { prix } = req.body;
            if (!prix || isNaN(parseFloat(prix)) || parseFloat(prix) <= 0) {
                req.flash('error', 'Prix invalide.');
                return res.redirect('/admin/formules');
            }
            const formule = await Formule.findById(req.params.id);
            if (!formule) {
                req.flash('error', 'Formule introuvable.');
                return res.redirect('/admin/formules');
            }
            await Formule.update(req.params.id, { prix });
            req.flash('success', `Prix de "${formule.nom}" mis à jour : ${parseInt(prix).toLocaleString('fr-FR')} FCFA.`);
        } catch (err) {
            req.flash('error', "Erreur mise à jour du prix.");
        }
        res.redirect('/admin/formules');
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
                try {
                    const oldAvatar = req.admin ? req.admin.avatar : null;
                    avatar = await uploadImage(req.file.buffer, 'admins', req.file.originalname, oldAvatar);
                }
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


    // ─── ADMIN — HISTORIQUE PAIEMENTS ───────────────────────────────────────────

    // GET /admin/historique
    async showHistory(req, res) {
        try {
            const { page = 1, type = '', statut = '', search = '' } = req.query;
            const limit  = 30;
            const offset = (parseInt(page) - 1) * limit;

            // ── Tranches abonnements ──────────────────────────────────────────
            let whereInst = 'WHERE 1=1';
            const paramsInst = [];
            if (statut === 'paye')      { whereInst += ' AND i.statut = ?'; paramsInst.push('paye'); }
            else if (statut === 'echec'){ whereInst += " AND i.statut = 'expire'"; }
            if (search) {
                whereInst += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.telephone LIKE ?)';
                paramsInst.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const [installments] = type !== 'boutique' ? await db.query(
                `SELECT i.*, u.nom as user_nom, u.prenom as user_prenom,
                        u.telephone, f.nom as formule_nom, s.id as subscription_id,
                        'abonnement' as type_paiement
                 FROM installments i
                 JOIN subscriptions s ON s.id = i.subscription_id
                 JOIN users u ON u.id = i.user_id
                 JOIN formules f ON f.id = s.formule_id
                 ${whereInst}
                 ORDER BY i.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...paramsInst, limit, offset]
            ) : [[]];

            // ── Commandes boutique ────────────────────────────────────────────
            let whereOrd = 'WHERE 1=1';
            const paramsOrd = [];
            if (statut === 'paye')      { whereOrd += " AND o.statut = 'paye'"; }
            else if (statut === 'echec'){ whereOrd += " AND o.statut = 'annule'"; }
            if (search) {
                whereOrd += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.telephone LIKE ?)';
                paramsOrd.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const [orders] = type !== 'abonnement' ? await db.query(
                `SELECT o.*, u.nom as user_nom, u.prenom as user_prenom,
                        u.telephone, p.nom as product_nom,
                        'boutique' as type_paiement
                 FROM orders o
                 JOIN users u ON u.id = o.user_id
                 JOIN products p ON p.id = o.product_id
                 ${whereOrd}
                 ORDER BY o.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...paramsOrd, limit, offset]
            ) : [[]];

            // ── Stats globales ────────────────────────────────────────────────
            const [[stats]] = await db.query(`
                SELECT
                    (SELECT COUNT(*) FROM installments WHERE statut = 'paye')    as tranches_payees,
                    (SELECT COALESCE(SUM(montant),0) FROM installments WHERE statut = 'paye') as montant_tranches,
                    (SELECT COUNT(*) FROM installments WHERE statut = 'expire')  as tranches_echec,
                    (SELECT COUNT(*) FROM orders WHERE statut = 'paye')          as orders_payees,
                    (SELECT COALESCE(SUM(montant_total),0) FROM orders WHERE statut = 'paye') as montant_orders,
                    (SELECT COUNT(*) FROM orders WHERE statut = 'annule')        as orders_echec
            `);

            res.render('admin/historique', {
                title: 'Historique des paiements — Admin',
                installments,
                orders,
                stats,
                type,
                statut,
                search,
                page: parseInt(page),
                success: req.flash('success'),
                error:   req.flash('error'),
            });
        } catch (err) {
            console.error('[Admin] showHistory:', err);
            req.flash('error', 'Erreur chargement historique.');
            res.redirect('/admin/dashboard');
        }
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
                sent ? 'Message test envoyé avec succès !' : "Échec de l'envoi. Vérifiez la connexion.");
        } catch (err) {
            req.flash('error', 'Erreur: ' + err.message);
        }
        res.redirect('/admin/whatsapp');
    },


};

module.exports = adminController;
