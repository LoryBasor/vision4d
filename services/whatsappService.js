'use strict';

require('dotenv').config();

let client    = null;
let isReady   = false;
let currentQR = null;   // QR base64 stocké pour /admin/whatsapp
let waStatus  = 'disconnected';
let waError   = null;

async function initWhatsApp() {
    try {
        const { Client, LocalAuth } = require('whatsapp-web.js');
        const QRCode = require('qrcode');

        client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            },
        });

        // QR Code → stocker en mémoire au lieu d'afficher dans la console
        client.on('qr', async (qr) => {
            try {
                currentQR = await QRCode.toDataURL(qr, {
                    width:  280,
                    margin: 2,
                    color: { dark: '#011826', light: '#ffffff' },
                });
                waStatus = 'qr_ready';
                waError  = null;
                console.log('[WhatsApp] QR Code prêt → /admin/whatsapp');
            } catch (e) {
                console.error('[WhatsApp] Erreur QR:', e.message);
            }
        });

        client.on('authenticated', () => {
            currentQR = null;
        });

        client.on('ready', () => {
            isReady   = true;
            currentQR = null;
            waStatus  = 'connected';
            waError   = null;
            console.log('[WhatsApp] ✅ Connecté');
        });

        client.on('disconnected', (reason) => {
            isReady  = false;
            waStatus = 'disconnected';
            console.log('[WhatsApp] Déconnecté:', reason);
            setTimeout(() => initWhatsApp(), 15000);
        });

        client.on('auth_failure', (msg) => {
            waError  = msg;
            waStatus = 'disconnected';
        });

        await client.initialize();

    } catch (err) {
        waError  = err.message;
        waStatus = 'disconnected';
        console.warn('[WhatsApp] Mode dégradé:', err.message);
    }
}

async function sendToAdmin(message) {
    const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '';
    if (!adminNumber) return false;

    if (isReady && client) {
        try {
            await client.sendMessage(adminNumber.replace(/[^0-9]/g, '') + '@c.us', message);
            return true;
        } catch (err) {
            console.error('[WhatsApp] Erreur envoi:', err.message);
        }
    }
    return false;
}

function getAdminWhatsAppLink(message) {
    const num     = (process.env.WHATSAPP_ADMIN_NUMBER || '237600000000').replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${num}?text=${encoded}`;
}

function getStatus()   { return waStatus; }
function getQRCode()   { return currentQR; }
function getError()    { return waError; }
function isConnected() { return isReady; }

function buildPaymentMessage({ client_nom, formule_nom, numero_tranche, nombre_tranches, montant, telephone }) {
    return `🎯 *VISION 4D — NOUVEAU PAIEMENT*\n\n👤 *Client:* ${client_nom}\n📱 *Téléphone:* ${telephone}\n📺 *Formule:* ${formule_nom}\n💳 *Tranche:* ${numero_tranche}/${nombre_tranches}\n💰 *Montant:* ${fmt(montant)} FCFA\n🕐 *Date:* ${new Date().toLocaleString('fr-FR')}\n\n✅ Paiement effectué avec succès.`;
}

function buildSubscriptionMessage({ client_nom, formule_nom, nombre_tranches, montant_total, telephone }) {
    return `🆕 *VISION 4D — NOUVEL ABONNEMENT*\n\n👤 *Client:* ${client_nom}\n📱 *Téléphone:* ${telephone}\n📺 *Formule:* ${formule_nom}\n📊 *Tranches:* ${nombre_tranches}\n💰 *Total:* ${fmt(montant_total)} FCFA\n🕐 *Date:* ${new Date().toLocaleString('fr-FR')}`;
}

function buildOrderMessage({ client_nom, product_nom, montant, telephone }) {
    return `🛍️ *VISION 4D — ACHAT BOUTIQUE*\n\n👤 *Client:* ${client_nom}\n📱 *Téléphone:* ${telephone}\n📦 *Produit:* ${product_nom}\n💰 *Montant:* ${fmt(montant)} FCFA\n🕐 *Date:* ${new Date().toLocaleString('fr-FR')}`;
}

function fmt(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)); }

module.exports = {
    initWhatsApp,
    sendToAdmin,
    getAdminWhatsAppLink,
    getStatus, getQRCode, getError, isConnected,
    buildPaymentMessage, buildSubscriptionMessage, buildOrderMessage,
    isReady: () => isReady,
};
