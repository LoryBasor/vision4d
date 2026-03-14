'use strict';

require('dotenv').config();

// Supprime le warning DEP0044 (util.isArray déprécié dans whatsapp-web.js)
// util.isArray est un alias de Array.isArray — on le restaure proprement
const util = require('util');
if (!util.isArray) {
    util.isArray = Array.isArray;
}

const app     = require('./app');
const Admin   = require('./models/Admin');
const whatsapp = require('./services/whatsappService');

const PORT = parseInt(process.env.PORT) || 3000;

async function start() {
    try {
        // Créer l'admin par défaut si nécessaire
        await Admin.createDefault();

        // Démarrer le serveur HTTP
        const server = app.listen(PORT, () => {
            console.log(`\n🚀 VISION 4D démarré sur http://localhost:${PORT}`);
            console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}`);
            console.log(`   Admin panel   : http://localhost:${PORT}/admin/connexion\n`);
        });

        // Initialiser WhatsApp en arrière-plan (optionnel)
        if (process.env.NODE_ENV !== 'test') {
            whatsapp.initWhatsApp().catch(err =>
                console.warn('WhatsApp non disponible:', err.message)
            );
        }

        // Expiration des tranches — toutes les heures
        setInterval(async () => {
            try {
                const { subscriptionService } = require('./services/subscriptionService');
                await subscriptionService.expireOverdue();
            } catch (e) { /* silencieux */ }
        }, 60 * 60 * 1000);

        // Gestion propre de l'arrêt
        const shutdown = (signal) => {
            console.log(`\n[${signal}] Arrêt du serveur...`);
            server.close(() => {
                console.log('Serveur arrêté proprement.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT',  () => shutdown('SIGINT'));

    } catch (err) {
        console.error('❌ Erreur au démarrage:', err);
        process.exit(1);
    }
}

start();
