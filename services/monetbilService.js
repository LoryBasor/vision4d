'use strict';

/**
 * ============================================================
 * VISION 4D — Service Monetbil
 * Conforme à la documentation officielle :
 *   - Widget API v2.1 (POST → retourne payment_url JSON)
 *   - Notification de paiements (sign, IP, statuts)
 * ============================================================
 */

const axios  = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

/**
 * Endpoint Widget v2.1
 * POST https://api.monetbil.com/widget/v2.1/{service_key}
 * Réponse : { success: true, payment_url: "https://api.monetbil.com/pay/v2.1/..." }
 */
const WIDGET_ENDPOINT = 'https://api.monetbil.com/widget/v2.1';

/**
 * IPs officielles des serveurs Monetbil (doc §4.1)
 */
const MONETBIL_ALLOWED_IPS = [
    '184.154.224.14',
    '184.154.224.222',
];

// ─── SERVICE ───────────────────────────────────────────────────────────────────

const monetbilService = {

    /**
     * Initier un paiement via le Widget Monetbil v2.1
     *
     * La doc officielle spécifie :
     *   POST https://api.monetbil.com/widget/v2.1/{service_key}
     *   Body (form-urlencoded) : amount (REQUIS), + champs optionnels
     *   Réponse JSON : { "success": true, "payment_url": "..." }
     *
     * @param {object} options
     * @param {number}  options.amount        Montant à facturer (REQUIS)
     * @param {string}  options.phone         Numéro prédéfini (active phone_lock automatiquement)
     * @param {string}  options.item_ref      Référence unique de l'article
     * @param {string}  options.payment_ref   Référence unique de la commande (si existe déjà → transaction interrompue)
     * @param {string}  options.first_name    Prénom de l'utilisateur
     * @param {string}  options.last_name     Nom de l'utilisateur
     * @param {string}  options.email         Email de l'utilisateur
     * @param {string}  options.user          Identifiant utilisateur dans votre système (retourné dans la notification)
     * @param {string}  options.return_url    URL de redirection après paiement
     * @param {string}  options.notify_url    URL du webhook de notification
     * @param {string}  options.locale        Langue 'fr' ou 'en' (défaut: fr)
     * @param {string}  options.operator      Code opérateur à présélectionner (ex: CM_MTNMOBILEMONEY)
     * @param {string}  options.country       Code ISO 3166-1 du pays (ex: CM)
     * @param {string}  options.currency      Monnaie (ex: XAF)
     *
     * @returns {Promise<string>} payment_url — URL vers laquelle rediriger le client
     * @throws  {Error}           si le service_key est absent ou si Monetbil répond une erreur
     */
    async initiatePayment({
        amount,
        phone       = '',
        item_ref    = '',
        payment_ref = '',
        first_name  = '',
        last_name   = '',
        email       = '',
        user        = '',
        return_url  = '',
        notify_url  = '',
        locale      = 'fr',
        operator    = '',
        country     = 'CM',
        currency    = 'XAF',
    }) {
        const serviceKey = process.env.MONETBIL_SERVICE_KEY;
        if (!serviceKey) {
            throw new Error('[Monetbil] La variable MONETBIL_SERVICE_KEY est absente du .env');
        }

        // Construction du body form-urlencoded
        const body = new URLSearchParams();

        // Champ REQUIS
        body.append('amount', String(Math.round(amount)));

        // Champs optionnels — n'ajouter que s'ils sont renseignés
        if (phone)       body.append('phone',       phone);
        if (item_ref)    body.append('item_ref',    item_ref);
        if (payment_ref) body.append('payment_ref', payment_ref);
        if (user)        body.append('user',        user);
        if (first_name)  body.append('first_name',  first_name);
        if (last_name)   body.append('last_name',   last_name);
        if (email)       body.append('email',       email);
        if (operator)    body.append('operator',    operator);

        body.append('locale',     locale);
        body.append('country',    country);
        body.append('currency',   currency);
        body.append('return_url', return_url  || process.env.MONETBIL_RETURN_URL  || '');
        body.append('notify_url', notify_url  || process.env.MONETBIL_NOTIFY_URL  || '');
        body.append('logo',       `${process.env.APP_URL || ''}/images/logo.png`);

        const url = `${WIDGET_ENDPOINT}/${serviceKey}`;

        console.log(`[Monetbil] Initiation paiement → POST ${url} | amount=${amount} | ref=${payment_ref}`);

        try {
            const response = await axios.post(url, body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000,
            });

            const data = response.data;

            // Valider la réponse : { success: true, payment_url: "..." }
            if (!data || !data.success || !data.payment_url) {
                const detail = data?.message || JSON.stringify(data);
                throw new Error(`[Monetbil] Réponse inattendue du widget : ${detail}`);
            }

            console.log(`[Monetbil] ✅ payment_url reçu : ${data.payment_url}`);
            return data.payment_url;

        } catch (err) {
            if (err.response) {
                const msg = `Erreur HTTP ${err.response.status} — ${JSON.stringify(err.response.data)}`;
                throw new Error(`[Monetbil] ${msg}`);
            }
            throw err;
        }
    },

    // ─── SIGNATURE ─────────────────────────────────────────────────────────────

    /**
     * Calculer la signature d'une notification Monetbil
     *
     * Algorithme (doc §4.3, exemple PHP) :
     *   ksort($params)  →  trier les clés alphabétiquement
     *   md5( $service_secret . implode('', $params) )
     *
     * @param {object} params  Paramètres de la notification SANS le champ 'sign'
     * @returns {string}       Hash MD5 attendu
     */
    computeSign(params) {
        const secret = process.env.MONETBIL_SERVICE_SECRET || '';

        // Trier par clé (ksort PHP = tri alphabétique des clés)
        const sorted = Object.keys(params)
            .sort()
            .map(k => params[k] ?? '');

        const raw = secret + sorted.join('');
        return crypto.createHash('md5').update(raw).digest('hex');
    },

    /**
     * Vérifier la signature d'une notification
     *
     * @param {object} params  Corps complet de la notification (contient 'sign')
     * @returns {boolean}
     */
    checkSign(params) {
        if (!params || !params.sign) return false;

        const receivedSign = params.sign;

        // Retirer 'sign' avant de recalculer
        const withoutSign = { ...params };
        delete withoutSign.sign;

        const expected = this.computeSign(withoutSign);
        const match    = receivedSign === expected;

        if (!match) {
            console.warn(`[Monetbil] Signature incorrecte | reçu: ${receivedSign} | attendu: ${expected}`);
        }
        return match;
    },

    // ─── VALIDATION IP ─────────────────────────────────────────────────────────

    /**
     * Vérifier que la requête entrante provient d'un serveur Monetbil
     * IPs autorisées (doc §4.1) : 184.154.224.14 et 184.154.224.222
     *
     * @param {string} remoteAddr  req.ip ou req.connection.remoteAddress
     * @returns {boolean}
     */
    validateServerIP(remoteAddr) {
        if (!remoteAddr) return false;
        // Normaliser le format IPv6-mapped (::ffff:x.x.x.x → x.x.x.x)
        const ip = remoteAddr.replace(/^::ffff:/, '');
        return MONETBIL_ALLOWED_IPS.includes(ip);
    },

    // ─── VALIDATION COMPLÈTE D'UNE NOTIFICATION ────────────────────────────────

    /**
     * Valider une notification de paiement reçue de Monetbil
     *
     * Étapes :
     *   1. Vérification IP (contournée en développement)
     *   2. Vérification de la signature MD5 (si service_secret configuré)
     *   3. Vérification des champs obligatoires
     *
     * Paramètres reçus dans la notification (doc §3) :
     *   service, transaction_id, transaction_uuid, phone, amount, fee,
     *   status, message, country_name, country_iso, country_code,
     *   mccmnc, operator, operator_code, operator_transaction_id,
     *   currency, user, item_ref, payment_ref, first_name, last_name,
     *   email, sign
     *
     * @param {object}  body        req.body — body de la notification
     * @param {string}  remoteAddr  req.ip
     * @returns {{ valid: boolean, reason?: string }}
     */
    validateNotification(body, remoteAddr) {
        const isProd = process.env.NODE_ENV === 'production';

        // 1. Vérification IP (uniquement en production)
        if (isProd && !this.validateServerIP(remoteAddr)) {
            console.warn(`[Monetbil] ⛔ IP refusée : ${remoteAddr}`);
            return { valid: false, reason: 'IP_NOT_ALLOWED' };
        }

        // 2. Vérification signature (si SECRET et sign présents)
        if (body.sign && process.env.MONETBIL_SERVICE_SECRET) {
            if (!this.checkSign(body)) {
                return { valid: false, reason: 'INVALID_SIGN' };
            }
        }

        // 3. Champ status obligatoire
        if (!body.status) {
            return { valid: false, reason: 'MISSING_STATUS' };
        }

        return { valid: true };
    },

    // ─── STATUTS ───────────────────────────────────────────────────────────────

    /**
     * Le paiement a-t-il réussi ?
     * Statuts officiels : "success" | "cancelled" | "failed"
     *
     * @param {string} status
     * @returns {boolean}
     */
    isSuccess(status) {
        return status === 'success';
    },

    isCancelled(status) {
        return status === 'cancelled';
    },

    isFailed(status) {
        return status === 'failed';
    },

    // ─── OPÉRATEURS (CAMEROUN) ──────────────────────────────────────────────────

    /**
     * Codes opérateurs Mobile Money Cameroun (XAF)
     * Source : doc "Liste des opérateurs"
     *
     *   CM_MTNMOBILEMONEY  → MTN Cameroon Ltd      min: 1     max: 1 000 000 XAF
     *   CM_ORANGEMONEY     → Orange Cameroun S.A   min: 1     max: 1 000 000 XAF
     *   CM_EUMM            → Express Union Finance min: 100   max:   500 000 XAF
     */
    OPERATORS_CM: {
        MTN:    'CM_MTNMOBILEMONEY',
        ORANGE: 'CM_ORANGEMONEY',
        EU:     'CM_EUMM',
    },
};

module.exports = monetbilService;
