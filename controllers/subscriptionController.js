'use strict';

const { v4: uuidv4 }      = require('uuid');
const Subscription        = require('../models/Subscription');
const Installment         = require('../models/Installment');
const subscriptionService = require('../services/subscriptionService');
const monetbilService     = require('../services/monetbilService');
const whatsapp            = require('../services/whatsappService');
const db                  = require('../config/database');

const subscriptionController = {

    // ─── GET /abonnement ──────────────────────────────────────────────────────
    async showPlans(req, res) {
        try {
            const formules           = await subscriptionService.getFormules();
            const tarifs             = await subscriptionService.getTarifs();
            const activeSubscription = await Subscription.findActiveByUser(req.user.id);
            let installments         = [];

            if (activeSubscription) {
                installments = await Installment.findBySubscription(activeSubscription.id);
            }

            res.render('client/subscription', {
                title:             'Mes Abonnements — Vision 4D',
                formules,
                tarifs,
                activeSubscription,
                installments,
                user:              req.user,
                success:           req.flash('success'),
                error:             req.flash('error'),
            });
        } catch (err) {
            console.error('[Subscription] showPlans:', err);
            req.flash('error', 'Erreur lors du chargement des formules.');
            res.redirect('/compte');
        }
    },

    // ─── POST /abonnement/souscrire ───────────────────────────────────────────
    async subscribe(req, res) {
        try {
            const { formule_id, nombre_tranches } = req.body;
            const user = req.user;

            // ── 1. Vérifier le numéro de décodeur ─────────────────────────────
            if (!user.numero_decodeur || !user.numero_decodeur.trim()) {
                req.flash('error', 'Vous devez renseigner votre numéro de décodeur Canal+ avant de souscrire un abonnement. Rendez-vous dans "Mon Compte".');
                return res.redirect('/compte');
            }

            // ── 2. Vérifier qu'il n'y a pas déjà un abonnement actif ou en attente ──
            const existing = await Subscription.findActiveByUser(user.id);
            if (existing) {
                if (existing.statut === 'en_attente_paiement') {
                    req.flash('error', 'Un abonnement est déjà en attente de paiement. Finalisez-le ou attendez son expiration.');
                } else {
                    req.flash('error', 'Vous avez déjà un abonnement actif.');
                }
                return res.redirect('/abonnement');
            }

            // ── 3. Valider la formule ──────────────────────────────────────────
            const [rows] = await db.query(
                'SELECT * FROM formules WHERE id = ? AND is_active = 1',
                [formule_id]
            );
            if (!rows[0]) {
                req.flash('error', 'Formule invalide. Veuillez réessayer.');
                return res.redirect('/abonnement');
            }
            const formule = rows[0];
            const nb      = Math.min(Math.max(parseInt(nombre_tranches) || 1, 1), 3);

            // ── 4. Calculer les frais et créer l'abonnement en BDD ────────────
            // IMPORTANT : l'abonnement est créé avec statut 'en_attente_paiement'.
            // Il ne passera à 'en_cours' QUE si le webhook Monetbil retourne 'success'.
            // Si le paiement est annulé ou échoue, l'abonnement est supprimé.
            const calc            = await subscriptionService.calculateInstallment(formule.prix, nb);
            const subscription_id = await Subscription.create({
                user_id:         user.id,
                formule_id:      formule.id,
                nombre_tranches: nb,
                montant_total:   formule.prix,
                frais_pourcent:  calc.frais_pourcent,
            });

            // ── 5. Préparer la première tranche ───────────────────────────────
            const firstInstallment = await Installment.findNextPending(subscription_id);
            if (!firstInstallment) {
                // Sécurité : ne devrait pas arriver
                await Subscription.cancelPending(subscription_id);
                req.flash('error', 'Erreur lors de la création des tranches. Veuillez réessayer.');
                return res.redirect('/abonnement');
            }

            const paymentRef = `V4D-${subscription_id}-T1-${uuidv4().slice(0, 8).toUpperCase()}`;
            await Installment.setPaymentToken(firstInstallment.id, paymentRef);

            // ── 6. Initier le paiement Monetbil ───────────────────────────────
            let paymentUrl;
            try {
                paymentUrl = await monetbilService.initiatePayment({
                    amount:      firstInstallment.montant,
                    phone:       user.telephone,
                    item_ref:    paymentRef,
                    payment_ref: paymentRef,
                    first_name:  user.prenom,
                    last_name:   user.nom,
                    user:        String(user.id),
                    return_url:  (process.env.APP_URL || 'http://localhost:3000') + '/payment/return',
                    notify_url:  (process.env.APP_URL || 'http://localhost:3000') + '/payment/notify',
                });
            } catch (monetbilErr) {
                // Si Monetbil est injoignable, annuler l'abonnement créé
                console.error('[Subscription] Monetbil erreur:', monetbilErr.message);
                await Subscription.cancelPending(subscription_id);
                req.flash('error', 'Le service de paiement est temporairement indisponible. Veuillez réessayer dans quelques instants.');
                return res.redirect('/abonnement');
            }

            // ── 7. Notifier l'admin (tentative de souscription) ───────────────
            const msg = whatsapp.buildSubscriptionMessage({
                client_nom:      `${user.prenom} ${user.nom}`,
                formule_nom:     formule.nom,
                nombre_tranches: nb,
                montant_total:   calc.montant_avec_frais,
                telephone:       user.telephone,
            });
            whatsapp.sendToAdmin(msg).catch(() => {}); // silencieux

            // Redirection directe vers Monetbil (formulaire classique, pas fetch)
            return res.redirect(paymentUrl);

        } catch (err) {
            console.error('[Subscription] subscribe:', err);
            req.flash('error', "Une erreur est survenue. Veuillez réessayer.");
            return res.redirect('/abonnement');
        }
    },

    // ─── POST /abonnement/payer/:installment_id ───────────────────────────────
    async payInstallment(req, res) {
        try {
            const { installment_id } = req.params;
            const installment        = await Installment.findById(installment_id);
            const user               = req.user;

            // Vérifications
            if (!installment || installment.user_id !== user.id) {
                req.flash('error', 'Tranche introuvable.');
                return res.redirect('/abonnement');
            }
            if (installment.statut !== 'en_attente') {
                req.flash('error', `Cette tranche est déjà ${installment.statut}.`);
                return res.redirect('/abonnement');
            }

            // Vérifier que c'est la prochaine tranche à payer (ordre obligatoire)
            const nextPending = await Installment.findNextPending(installment.subscription_id);
            if (!nextPending || nextPending.id !== parseInt(installment_id)) {
                req.flash('error', 'Veuillez payer les tranches dans l\'ordre.');
                return res.redirect('/abonnement');
            }

            const sub        = await Subscription.findByIdWithInstallments(installment.subscription_id);
            const paymentRef = `V4D-${installment.subscription_id}-T${installment.numero_tranche}-${uuidv4().slice(0, 8).toUpperCase()}`;
            await Installment.setPaymentToken(installment.id, paymentRef);

            let paymentUrl;
            try {
                paymentUrl = await monetbilService.initiatePayment({
                    amount:      installment.montant,
                    phone:       user.telephone,
                    item_ref:    paymentRef,
                    payment_ref: paymentRef,
                    first_name:  user.prenom,
                    last_name:   user.nom,
                    user:        String(user.id),
                    return_url:  (process.env.APP_URL || 'http://localhost:3000') + '/payment/return',
                    notify_url:  (process.env.APP_URL || 'http://localhost:3000') + '/payment/notify',
                });
            } catch (monetbilErr) {
                req.flash('error', 'Service de paiement indisponible. Réessayez dans un instant.');
                return res.redirect('/abonnement');
            }

            res.redirect(paymentUrl);
        } catch (err) {
            console.error('[Subscription] payInstallment:', err);
            req.flash('error', 'Erreur lors de l\'initiation du paiement.');
            res.redirect('/abonnement');
        }
    },


    // ─── POST /abonnement/:id/annuler (client) ────────────────────────────────
    async cancelSubscription(req, res) {
        try {
            const sub = await Subscription.findByIdWithInstallments(req.params.id);

            if (!sub || sub.user_id !== req.user.id) {
                req.flash('error', 'Abonnement introuvable.');
                return res.redirect('/abonnement');
            }

            if (!['en_cours', 'en_attente_paiement'].includes(sub.statut)) {
                req.flash('error', 'Cet abonnement ne peut pas être annulé.');
                return res.redirect('/abonnement');
            }

            // Si aucune tranche n'a été payée → supprimer complètement
            const tranchesPaidCount = sub.installments.filter(function(i) {
                return i.statut === 'paye';
            }).length;

            if (tranchesPaidCount === 0) {
                await Subscription.cancelPending(sub.id);
                req.flash('success', 'Abonnement annulé et supprimé (aucun paiement effectué).');
            } else {
                // Des tranches ont été payées → marquer comme annulé (garder l'historique)
                await Subscription.cancel(sub.id);
                req.flash('success', 'Abonnement annulé. Les tranches déjà payées restent dans votre historique.');
            }

            res.redirect('/abonnement');
        } catch (err) {
            console.error('[Subscription] cancelSubscription:', err);
            req.flash('error', "Erreur lors de l'annulation.");
            res.redirect('/abonnement');
        }
    },

    // ─── POST /payment/notify — Webhook Monetbil ─────────────────────────────
    // ⚠️  Route EXCLUE du CSRF car appelée directement par les serveurs Monetbil
    async paymentNotify(req, res) {
        // Répondre immédiatement 200 à Monetbil — ne jamais laisser Monetbil attendre
        res.sendStatus(200);

        try {
            const remoteAddr = req.ip || req.connection.remoteAddress;
            const body       = req.body;

            console.log('[Monetbil] Notification reçue :', JSON.stringify(body));

            // ── Valider la notification (IP + signature) ───────────────────────
            const validation = monetbilService.validateNotification(body, remoteAddr);
            if (!validation.valid) {
                console.warn(`[Monetbil] Notification rejetée : ${validation.reason}`);
                return;
            }

            const tokenRef    = body.item_ref || body.payment_ref;
            const installment = await Installment.findByToken(tokenRef);

            if (!installment) {
                console.warn(`[Monetbil] Tranche introuvable pour ref: ${tokenRef}`);
                return;
            }

            // ── CAS 1 : Paiement RÉUSSI ────────────────────────────────────────
            if (monetbilService.isSuccess(body.status)) {

                if (installment.statut === 'paye') {
                    console.log(`[Monetbil] Tranche #${installment.id} déjà payée — doublon ignoré`);
                    return;
                }

                // Marquer la tranche comme payée
                await Installment.markPaid(installment.id, {
                    transaction_id: body.transaction_uuid || body.transaction_id,
                    payment_ref:    tokenRef,
                });

                // Récupérer l'abonnement
                const sub = await Subscription.findByIdWithInstallments(installment.subscription_id);

                // Si c'est la 1ère tranche et que l'abonnement était en attente → activer
                if (installment.numero_tranche === 1 && sub.statut === 'en_attente_paiement') {
                    await Subscription.confirmAfterPayment(sub.id);
                    console.log(`[Monetbil] ✅ Abonnement #${sub.id} activé après paiement 1ère tranche`);
                } else {
                    // Mettre à jour la progression pour les tranches suivantes
                    const payees = sub.installments.filter(i => i.statut === 'paye').length;
                    await Subscription.updateProgress(sub.id, payees, sub.nombre_tranches);
                }

                // Notifier l'admin WhatsApp
                const [userRows] = await db.query(
                    'SELECT * FROM users WHERE id = ? LIMIT 1',
                    [installment.user_id]
                );
                const user = userRows[0];
                if (user) {
                    const msg = whatsapp.buildPaymentMessage({
                        client_nom:      `${user.prenom} ${user.nom}`,
                        formule_nom:     sub.formule_nom,
                        numero_tranche:  installment.numero_tranche,
                        nombre_tranches: sub.nombre_tranches,
                        montant:         installment.montant,
                        telephone:       user.telephone,
                    });
                    whatsapp.sendToAdmin(msg).catch(() => {});
                }

                console.log(`[Monetbil] ✅ Tranche #${installment.id} payée — ${body.amount} ${body.currency || 'XAF'}`);

            // ── CAS 2 : Paiement ANNULÉ ou ÉCHOUÉ ────────────────────────────
            } else {
                console.log(`[Monetbil] Paiement non réussi — statut: ${body.status}`);

                // Si c'est la 1ère tranche et l'abonnement est en attente de paiement
                // → supprimer proprement l'abonnement (il n'a pas lieu d'être)
                if (installment.numero_tranche === 1) {
                    const sub = await Subscription.findByIdWithInstallments(installment.subscription_id);
                    if (sub && sub.statut === 'en_attente_paiement') {
                        await Subscription.cancelPending(sub.id);
                        console.log(`[Monetbil] 🗑️  Abonnement #${sub.id} supprimé (paiement ${body.status})`);
                    }
                }
                // Pour les tranches 2 et 3 : on ne supprime pas l'abonnement existant,
                // on laisse la tranche en 'en_attente' pour que l'utilisateur réessaie
            }

        } catch (err) {
            console.error('[Monetbil] Erreur traitement notification:', err.message);
        }
    },

    // ─── GET /payment/return — Retour après paiement ─────────────────────────
    // Route PUBLIQUE — pas d'auth requise (Monetbil redirige ici)
    async paymentReturn(req, res) {
        try {
            // Monetbil envoie : ?status=success|cancelled|failed&payment_ref=...
            const { payment_ref, status, transaction_id } = req.query;

            // Vérifier le statut — plusieurs formats possibles selon la version Monetbil
            const success = monetbilService.isSuccess(status);
            const cancelled = monetbilService.isCancelled(status);

            // user peut être null si session expirée — on gère les deux cas
            const user = req.user || null;

            // Lien WhatsApp admin
            let waLink = whatsapp.getAdminWhatsAppLink(
                "Bonjour, je viens d'effectuer un paiement Vision 4D." +
                (user ? '\nNom: ' + user.prenom + ' ' + user.nom : '') +
                '\nRéf: ' + (payment_ref || transaction_id || 'N/A') +
                '\nStatut: ' + (status || 'inconnu')
            );

            // Si paiement réussi et utilisateur connecté, chercher l'abonnement actif
            let activeSubscription = null;
            if (success && user) {
                try {
                    const Subscription = require('../models/Subscription');
                    activeSubscription = await Subscription.findActiveByUser(user.id);
                } catch(e) { /* silencieux */ }
            }

            res.render('client/payment-return', {
                title:             success ? 'Paiement réussi — Vision 4D' : 'Paiement non abouti — Vision 4D',
                success,
                cancelled,
                status:            status || '',
                payment_ref:       payment_ref || '',
                waLink,
                user,
                activeSubscription,
            });
        } catch (err) {
            console.error('[PaymentReturn]', err.message);
            res.redirect('/');
        }
    },
};

module.exports = subscriptionController;
