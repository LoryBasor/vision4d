'use strict';

require('dotenv').config();

/**
 * Service WhatsApp — compatible Render/hébergement cloud
 *
 * Fonctionnement :
 *   - Le QR code est généré en base64 et stocké en mémoire
 *   - L'admin le scanne depuis le panel admin (/admin/whatsapp)
 *   - La session est sauvegardée localement (LocalAuth)
 *   - En mode dégradé (pas de Chromium), les liens wa.me fonctionnent quand même
 */

let client       = null;
let isReady      = false;
let currentQR    = null;   // QR code en base64 pour affichage dans le panel admin
let status       = 'disconnected'; // 'disconnected' | 'qr_ready' | 'connected'
let initError    = null;

// ─── INITIALISATION ───────────────────────────────────────────────────────────

async function initWhatsApp() {
    try {
        const { Client, LocalAuth } = require('whatsapp-web.js');
        const QRCode = require('qrcode');

        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: process.env.WA_SESSION_PATH || './.wwebjs_auth',
            }),
            puppeteer: {
                headless:  true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                ],
                // Sur Render, Chromium est dans un chemin spécifique
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            },
        });

        // ── QR Code disponible → le stocker en mémoire pour le panel admin ──
        client.on('qr', async (qr) => {
            try {
                // Convertir en image base64 pour l'afficher dans une page web
                currentQR = await QRCode.toDataURL(qr, {
                    width:            300,
                    margin:           2,
                    color: { dark: '#011826', light: '#ffffff' },
                });
                status = 'qr_ready';
                console.log('[WhatsApp] 📱 QR Code disponible — allez sur /admin/whatsapp pour le scanner');
            } catch (e) {
                console.error('[WhatsApp] Erreur génération QR:', e.message);
            }
        });

        // ── Authentification réussie ──────────────────────────────────────────
        client.on('authenticated', () => {
            console.log('[WhatsApp] ✅ Authentifié');
            currentQR = null;
            status    = 'connected';
        });

        // ── Prêt à envoyer ────────────────────────────────────────────────────
        client.on('ready', () => {
            isReady   = true;
            currentQR = null;
            status    = 'connected';
            console.log('[WhatsApp] ✅ Connecté et prêt');
        });

        // ── Déconnexion ───────────────────────────────────────────────────────
        client.on('disconnected', (reason) => {
            isReady = false;
            status  = 'disconnected';
            console.log('[WhatsApp] ⚠️ Déconnecté:', reason);
            // Réinitialiser après 10 secondes
            setTimeout(() => {
                console.log('[WhatsApp] Tentative de reconnexion...');
                client.initialize().catch(() => {});
            }, 10000);
        });

        await client.initialize();

    } catch (err) {
        initError = err.message;
        status    = 'disconnected';
        console.warn('[WhatsApp] ⚠️ Non initialisé (mode dégradé) :', err.message);
        console.warn('[WhatsApp] Les notifications seront envoyées via les liens wa.me/');
    }
}

// ─── ENVOI DE MESSAGE ─────────────────────────────────────────────────────────

async function sendToAdmin(message) {
    const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '';
    if (!adminNumber) return false;

    if (isReady && client) {
        try {
            const chatId = adminNumber.replace(/[^0-9]/g, '') + '@c.us';
            await client.sendMessage(chatId, message);
            console.log('[WhatsApp] ✅ Message envoyé');
            return true;
        } catch (err) {
            console.error('[WhatsApp] Erreur envoi:', err.message);
        }
    }

    // Mode dégradé — juste logger
    console.log('[WhatsApp MODE DÉGRADÉ]', message.substring(0, 100));
    return false;
}

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function getAdminWhatsAppLink(message) {
    const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '237600000000';
    const encoded     = encodeURIComponent(message);
    return `https://wa.me/${adminNumber.replace(/[^0-9]/g, '')}?text=${encoded}`;
}

function getStatus()   { return status; }
function getQRCode()   { return currentQR; }
function getError()    { return initError; }
function isConnected() { return isReady; }

// ─── MESSAGES ────────────────────────────────────────────────────────────────

function buildPaymentMessage({ client_nom, formule_nom, numero_tranche, nombre_tranches, montant, telephone }) {
    return `🎯 *VISION 4D — NOUVEAU PAIEMENT*

👤 *Client:* ${client_nom}
📱 *Téléphone:* ${telephone}
📺 *Formule:* ${formule_nom}
💳 *Tranche:* ${numero_tranche}/${nombre_tranches}
💰 *Montant:* ${formatAmount(montant)} FCFA
🕐 *Date:* ${new Date().toLocaleString('fr-FR')}

✅ Paiement effectué avec succès.`;
}

function buildSubscriptionMessage({ client_nom, formule_nom, nombre_tranches, montant_total, telephone }) {
    return `🆕 *VISION 4D — NOUVEL ABONNEMENT*

👤 *Client:* ${client_nom}
📱 *Téléphone:* ${telephone}
📺 *Formule:* ${formule_nom}
📊 *Tranches:* ${nombre_tranches}
💰 *Total:* ${formatAmount(montant_total)} FCFA
🕐 *Date:* ${new Date().toLocaleString('fr-FR')}`;
}

function buildOrderMessage({ client_nom, product_nom, montant, telephone }) {
    return `🛍️ *VISION 4D — ACHAT BOUTIQUE*

👤 *Client:* ${client_nom}
📱 *Téléphone:* ${telephone}
📦 *Produit:* ${product_nom}
💰 *Montant:* ${formatAmount(montant)} FCFA
🕐 *Date:* ${new Date().toLocaleString('fr-FR')}`;
}

function formatAmount(amount) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
}

module.exports = {
    initWhatsApp,
    sendToAdmin,
    getAdminWhatsAppLink,
    getStatus,
    getQRCode,
    getError,
    isConnected,
    buildPaymentMessage,
    buildSubscriptionMessage,
    buildOrderMessage,
    isReady: () => isReady,
};
