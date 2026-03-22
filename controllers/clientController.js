'use strict';

const { validationResult } = require('express-validator');
const Notification         = require('../models/Notification');
const User                 = require('../models/User');
const Subscription         = require('../models/Subscription');
const Installment          = require('../models/Installment');
const { uploadImage }      = require('../services/uploadService');
const whatsapp             = require('../services/whatsappService');

const clientController = {

    // GET /compte
    async showAccount(req, res) {
        try {
            const user         = req.user;
            const subscription = await Subscription.findActiveByUser(user.id);
            let installments   = [];

            if (subscription) {
                installments = await Installment.findBySubscription(subscription.id);
            }

            res.render('client/account', {
                title:        'Mon Compte — Vision 4D',
                user,
                subscription,
                installments,
                success:      req.flash('success'),
                error:        req.flash('error'),
            });
        } catch (err) {
            console.error('[Client] showAccount:', err);
            res.render('client/error', {
                title:   'Erreur',
                message: 'Erreur lors du chargement de votre compte.',
                code:    500,
            });
        }
    },

    // POST /compte/profil
    async updateProfile(req, res) {
        // Vérification CSRF manuelle (route multipart — multer parse avant le middleware CSRF global)
        if (!req.app.locals.verifyCsrf(req, res)) {
            req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
            return res.redirect('/compte');
        }

        try {
            const { nom, prenom, telephone } = req.body;
            let avatar = undefined;

            // Upload de la photo de profil si un fichier a été envoyé
            if (req.file && req.file.buffer) {
                try {
                    // Passer l'ancienne URL pour qu'elle soit supprimée sur Cloudinary
                    const oldAvatar = req.user.avatar || null;
                    avatar = await uploadImage(
                        req.file.buffer,
                        'avatars',
                        req.file.originalname,
                        oldAvatar
                    );
                    console.log('[Profile] Avatar uploadé:', avatar);
                } catch (uploadErr) {
                    console.error('[Profile] Échec upload avatar:', uploadErr.message);
                    req.flash('error', 'Impossible d\'uploader la photo. Profil mis à jour sans photo.');
                    // On continue sans avatar — ne pas bloquer la mise à jour du profil
                }
            }

            await User.updateProfile(req.user.id, { nom, prenom, telephone, avatar });
            req.flash('success', 'Profil mis à jour avec succès.');
        } catch (err) {
            console.error('[Client] updateProfile:', err);
            req.flash('error', 'Erreur lors de la mise à jour du profil.');
        }

        res.redirect('/compte');
    },

    // POST /compte/mot-de-passe
    async updatePassword(req, res) {
        try {
            const { current_password, new_password, confirm_new_password } = req.body;

            // Vérifier que les deux nouveaux mots de passe correspondent
            if (new_password !== confirm_new_password) {
                req.flash('error', 'Les nouveaux mots de passe ne correspondent pas.');
                return res.redirect('/compte');
            }

            if (!new_password || new_password.length < 6) {
                req.flash('error', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
                return res.redirect('/compte');
            }

            // Récupérer l'utilisateur avec son hash
            const user  = await User.findByEmail(req.user.email);
            const valid = await User.verifyPassword(current_password, user.password);

            if (!valid) {
                req.flash('error', 'Mot de passe actuel incorrect.');
                return res.redirect('/compte');
            }

            await User.updatePassword(req.user.id, new_password);
            req.flash('success', 'Mot de passe modifié avec succès.');
        } catch (err) {
            console.error('[Client] updatePassword:', err);
            req.flash('error', 'Erreur lors du changement de mot de passe.');
        }

        res.redirect('/compte');
    },

    // POST /compte/decodeur
    async setDecodeur(req, res) {
        try {
            const { numero_decodeur } = req.body;

            if (!numero_decodeur || !numero_decodeur.trim()) {
                req.flash('error', 'Le numéro de décodeur est requis.');
                return res.redirect('/compte');
            }

            await User.setDecodeur(req.user.id, numero_decodeur.trim());
            req.flash('success', 'Numéro de décodeur enregistré avec succès.');
        } catch (err) {
            console.error('[Client] setDecodeur:', err);
            req.flash('error', 'Erreur lors de l\'enregistrement du décodeur.');
        }

        res.redirect('/compte');
    },

    // GET /compte/historique
    async showHistory(req, res) {
        const user_id = req.user.id;

        // Stats et transactions — avec valeurs par défaut garanties
        let transactions = [];
        let subscriptions = [];
        let stats = { nb_reussies: 0, nb_echecs: 0, total_paye: 0 };

        try { subscriptions = await Subscription.findByUser(user_id); } catch(e) {}

        // Essayer notifications en premier, fallback sur installments+orders
        try {
            transactions = await Notification.findByUser(user_id);
            const s      = await Notification.getStatsByUser(user_id);
            if (s) stats = s;
        } catch (e) {
            console.warn('[History] Fallback BDD direct:', e.message);
            try {
                const db2 = require('../config/database');
                const [instRows] = await db2.query(
                    `SELECT i.*, f.nom as formule_nom, s.nombre_tranches
                     FROM installments i
                     JOIN subscriptions s ON s.id = i.subscription_id
                     JOIN formules f ON f.id = s.formule_id
                     WHERE i.user_id = ? ORDER BY i.created_at DESC`,
                    [user_id]
                );
                const [orderRows] = await db2.query(
                    `SELECT o.*, p.nom as product_nom, p.image_url as product_image
                     FROM orders o JOIN products p ON p.id = o.product_id
                     WHERE o.user_id = ? ORDER BY o.created_at DESC`,
                    [user_id]
                );
                transactions = [
                    ...instRows.map(function(i) {
                        return {
                            type: 'paiement_tranche',
                            statut: i.statut === 'paye' ? 'success' : i.statut === 'expire' ? 'failed' : 'pending',
                            montant: i.montant,
                            created_at: i.created_at,
                            formule_nom: i.formule_nom,
                            details: JSON.stringify({ numero_tranche: i.numero_tranche, nombre_tranches: i.nombre_tranches }),
                        };
                    }),
                    ...orderRows.map(function(o) {
                        return {
                            type: 'paiement_commande',
                            statut: o.statut === 'paye' ? 'success' : o.statut === 'annule' ? 'cancelled' : 'pending',
                            montant: o.montant_total,
                            created_at: o.created_at,
                            product_nom: o.product_nom,
                            product_image: o.product_image,
                            details: JSON.stringify({ product_nom: o.product_nom }),
                        };
                    }),
                ].sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); });

                const paid = transactions.filter(function(t){ return t.statut === 'success'; });
                stats = {
                    nb_reussies: paid.length,
                    nb_echecs:   transactions.filter(function(t){ return t.statut==='failed'||t.statut==='cancelled'; }).length,
                    total_paye:  paid.reduce(function(s,t){ return s + parseFloat(t.montant||0); }, 0),
                };
            } catch(e2) {
                console.error('[History] Fallback échoué:', e2.message);
            }
        }

        res.render('client/history', {
            title:        'Historique — Vision 4D',
            transactions,
            subscriptions,
            stats,
            user:         req.user,
            success:      req.flash('success'),
            error:        req.flash('error'),
        });
    },
};

module.exports = clientController;
