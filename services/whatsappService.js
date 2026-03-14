'use strict';

require('dotenv').config();

/**
 * Service WhatsApp
 * Utilise whatsapp-web.js pour envoyer des notifications à l'admin
 * et génère les liens de redirection pour le client
 */

let client    = null;
let isReady   = false;

/**
 * Initialiser le client WhatsApp
 * Cette fonction est appelée au démarrage du serveur
 */
async function initWhatsApp() {
    try {
        const { Client, LocalAuth } = require('whatsapp-web.js');
        const qrcode = require('qrcode');

        client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });

        client.on('qr', async (qr) => {
            console.log('\n📱 Scanner ce QR Code WhatsApp:\n');
            // Afficher en terminal
            const qrTerminal = await qrcode.toString(qr, { type: 'terminal', small: true });
            console.log(qrTerminal);
        });

        client.on('ready', () => {
            isReady = true;
            console.log('✅ WhatsApp connecté et prêt');
        });

        client.on('disconnected', () => {
            isReady = false;
            console.log('⚠️ WhatsApp déconnecté');
        });

        await client.initialize();
    } catch (err) {
        console.warn('⚠️ WhatsApp non initialisé (mode dégradé):', err.message);
    }
}

/**
 * Envoyer un message WhatsApp à l'admin
 */
async function sendToAdmin(message) {
    const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '';
    if (!adminNumber) return false;

    if (isReady && client) {
        try {
            const chatId = adminNumber.replace('+', '') + '@c.us';
            await client.sendMessage(chatId, message);
            console.log('[WhatsApp] Message envoyé à l\'admin');
            return true;
        } catch (err) {
            console.error('[WhatsApp] Erreur envoi:', err.message);
        }
    }

    // Fallback: log le message
    console.log('[WhatsApp LOG]', message);
    return false;
}

/**
 * Générer le lien WhatsApp pour rediriger le client
 */
function getAdminWhatsAppLink(message) {
    const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '237600000000';
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${adminNumber.replace('+', '')}?text=${encoded}`;
}

/**
 * Message de notification — Paiement tranche
 */
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

/**
 * Message de notification — Nouvel abonnement
 */
function buildSubscriptionMessage({ client_nom, formule_nom, nombre_tranches, montant_total, telephone }) {
    return `🆕 *VISION 4D — NOUVEL ABONNEMENT*

👤 *Client:* ${client_nom}
📱 *Téléphone:* ${telephone}
📺 *Formule:* ${formule_nom}
📊 *Tranches:* ${nombre_tranches}
💰 *Total:* ${formatAmount(montant_total)} FCFA
🕐 *Date:* ${new Date().toLocaleString('fr-FR')}`;
}

/**
 * Message de notification — Achat produit
 */
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
    buildPaymentMessage,
    buildSubscriptionMessage,
    buildOrderMessage,
    isReady: () => isReady,
};
