/**
 * Configuration Puppeteer
 * Indique où télécharger et stocker Chromium
 * Compatible avec Render, Railway, Heroku
 */
const { join } = require('path');

module.exports = {
    // Dossier de cache pour Chromium (dans le projet, pas dans ~/.cache)
    cacheDirectory: join(__dirname, '.puppeteer-cache'),
};
