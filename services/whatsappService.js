'use strict';

require('dotenv').config();

const path = require('path');
const fs   = require('fs');

const AUTH_FOLDER = path.join(__dirname, '..', 'baileys_auth');

// ─── État ─────────────────────────────────────────────────────────
let sock      = null;
let isReady   = false;
let currentQR = null;
let waStatus  = 'disconnected'; // 'disconnected' | 'qr_ready' | 'connected' | 'error'
let waError   = null;
let retrying  = false;

// ─── initWhatsApp ─────────────────────────────────────────────────
async function initWhatsApp() {
    // Éviter les doubles initialisations
    if (retrying) return;
    retrying = true;

    try {
        // Fermer proprement l'ancien socket s'il existe
        if (sock) {
            try { sock.ev.removeAllListeners(); sock.end(); } catch (_) {}
            sock = null;
        }

        isReady  = false;
        waStatus = 'disconnected';
        waError  = null;

        const Baileys = require('@whiskeysockets/baileys');

        const makeWASocket          = Baileys.default || Baileys.makeWASocket || Baileys;
        const useMultiFileAuthState = Baileys.useMultiFileAuthState;
        const DisconnectReason      = Baileys.DisconnectReason;
        const fetchLatestBaileysVersion = Baileys.fetchLatestBaileysVersion;
        const { Boom }              = require('@hapi/boom');
        const QRCode                = require('qrcode');
        const pino                  = require('pino');

        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

        // Version WhatsApp Web la plus récente
        let version = [2, 3000, 1015901307];
        try {
            const v = await fetchLatestBaileysVersion();
            if (v && v.version) version = v.version;
        } catch (_) {}

        console.log(`[WhatsApp] Connexion avec version ${version.join('.')}`);

        sock = makeWASocket({
            version,
            auth:                   state,
            logger:                 pino({ level: 'silent' }),
            printQRInTerminal:      false,
            connectTimeoutMs:       60_000,
            defaultQueryTimeoutMs:  30_000,
            keepAliveIntervalMs:    30_000,
            retryRequestDelayMs:    2_000,
            // Pas besoin de récupérer les messages entrants
            getMessage: async () => ({ conversation: '' }),
            // Désactiver les fonctionnalités inutiles
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

            if (qr) {
                try {
                    currentQR = await QRCode.toDataURL(qr, {
                        width: 280, margin: 2,
                        color: { dark: '#011826', light: '#ffffff' },
                    });
                    waStatus = 'qr_ready';
                    waError  = null;
                    console.log('[WhatsApp] QR prêt → /admin/whatsapp');
                } catch (e) {
                    console.error('[WhatsApp] Erreur génération QR:', e.message);
                }
            }

            if (connection === 'open') {
                isReady   = true;
                currentQR = null;
                waStatus  = 'connected';
                waError   = null;
                retrying  = false;
                console.log('[WhatsApp] ✅ Connecté');
            }

            if (connection === 'close') {
                isReady  = false;
                waStatus = 'disconnected';
                retrying = false;

                const boom       = lastDisconnect?.error;
                const statusCode = (boom instanceof Boom) ? boom.output?.statusCode : null;
                const isLogout   = statusCode === (DisconnectReason?.loggedOut ?? 401);

                console.log(`[WhatsApp] Déconnecté (code: ${statusCode ?? 'inconnu'})`);

                if (isLogout) {
                    // Logout volontaire → effacer la session et redemander un QR
                    waError = 'Session déconnectée. Re-scannez le QR.';
                    try {
                        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
                    } catch (_) {}
                    console.log('[WhatsApp] Session supprimée → nouveau QR dans 3s');
                    setTimeout(initWhatsApp, 3000);
                } else {
                    // Déconnexion réseau → reconnexion automatique dans 10s
                    console.log('[WhatsApp] Reconnexion automatique dans 10s...');
                    setTimeout(initWhatsApp, 10_000);
                }
            }
        });

    } catch (err) {
        retrying = false;
        waError  = err.message;
        waStatus = 'error';
        console.error('[WhatsApp] Erreur init:', err.message);
        // Réessayer dans 30s
        setTimeout(initWhatsApp, 30_000);
    }
}

// ─── sendToAdmin ─────────────────────────────────────────────────
async function sendToAdmin(message) {
    const num = (process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/[^0-9]/g, '');
    if (!num)            { console.warn('[WhatsApp] WHATSAPP_ADMIN_NUMBER non défini'); return false; }
    if (!isReady || !sock) { console.warn('[WhatsApp] Non connecté'); return false; }

    try {
        await sock.sendMessage(num + '@s.whatsapp.net', { text: message });
        return true;
    } catch (err) {
        console.error('[WhatsApp] Erreur envoi:', err.message);
        return false;
    }
}

// ─── Builders ────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)); }

function buildPaymentMessage({ client_nom, formule_nom, numero_tranche, nombre_tranches, montant, telephone }) {
    return `🎯 *VISION 4D — PAIEMENT REÇU*\n\n👤 *Client :* ${client_nom}\n📱 *Téléphone :* ${telephone}\n📺 *Formule :* Canal+ ${formule_nom}\n💳 *Tranche :* ${numero_tranche}/${nombre_tranches}\n💰 *Montant :* ${fmt(montant)} FCFA\n🕐 *Date :* ${new Date().toLocaleString('fr-FR')}\n\n✅ Paiement confirmé.`;
}

function buildSubscriptionMessage({ client_nom, formule_nom, nombre_tranches, montant_total, telephone }) {
    return `🆕 *VISION 4D — SOUSCRIPTION*\n\n👤 *Client :* ${client_nom}\n📱 *Téléphone :* ${telephone}\n📺 *Formule :* Canal+ ${formule_nom}\n📊 *Tranches :* ${nombre_tranches}\n💰 *Total :* ${fmt(montant_total)} FCFA\n🕐 ${new Date().toLocaleString('fr-FR')}`;
}

function buildOrderMessage({ client_nom, product_nom, montant, telephone }) {
    return `🛍️ *VISION 4D — ACHAT BOUTIQUE*\n\n👤 *Client :* ${client_nom}\n📱 *Téléphone :* ${telephone}\n📦 *Produit :* ${product_nom}\n💰 *Montant :* ${fmt(montant)} FCFA\n🕐 ${new Date().toLocaleString('fr-FR')}`;
}

function getAdminWhatsAppLink(message) {
    const num = (process.env.WHATSAPP_ADMIN_NUMBER || '237600000000').replace(/[^0-9]/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function getStatus()   { return waStatus; }
function getQRCode()   { return currentQR; }
function getError()    { return waError; }
function isConnected() { return isReady; }

module.exports = {
    initWhatsApp, sendToAdmin, getAdminWhatsAppLink,
    getStatus, getQRCode, getError, isConnected,
    isReady: () => isReady,
    buildPaymentMessage, buildSubscriptionMessage, buildOrderMessage,
};
