'use strict';

const { validationResult } = require('express-validator');
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
        try {
            const subscriptions = await Subscription.findByUser(req.user.id);
            res.render('client/history', {
                title:         'Historique — Vision 4D',
                subscriptions,
            });
        } catch (err) {
            console.error('[Client] showHistory:', err);
            req.flash('error', 'Erreur lors du chargement de l\'historique.');
            res.redirect('/compte');
        }
    },
};

module.exports = clientController;
