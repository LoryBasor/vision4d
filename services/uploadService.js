'use strict';

/**
 * Service d'upload d'images
 * - Si Cloudinary est configuré : upload sur Cloudinary
 * - Sinon : sauvegarde locale dans public/uploads/
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Vérifie si Cloudinary est correctement configuré
 */
function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY    &&
        process.env.CLOUDINARY_API_SECRET &&
        process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
    );
}

/**
 * Upload une image depuis un buffer
 * @param {Buffer} buffer     - Buffer du fichier (req.file.buffer)
 * @param {string} folder     - Dossier de destination (ex: 'avatars', 'products')
 * @param {string} filename   - Nom de fichier sans extension (optionnel)
 * @returns {Promise<string>} - URL publique de l'image
 */
async function uploadImage(buffer, folder = 'uploads', filename = '') {
    if (!buffer) throw new Error('Buffer image manquant');

    if (isCloudinaryConfigured()) {
        // ── Upload Cloudinary ──────────────────────────────────────────────────
        const cloudinary = require('../config/cloudinary');
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder:          `vision4d/${folder}`,
                    resource_type:   'image',
                    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                    transformation:  [{ quality: 'auto', fetch_format: 'auto' }],
                },
                (err, result) => {
                    if (err) {
                        console.error('[Upload] Erreur Cloudinary:', err.message);
                        reject(new Error(`Cloudinary: ${err.message}`));
                    } else {
                        resolve(result.secure_url);
                    }
                }
            );
            stream.end(buffer);
        });
    } else {
        // ── Fallback : stockage local ──────────────────────────────────────────
        console.warn('[Upload] Cloudinary non configuré — stockage local utilisé');

        // Créer le dossier si nécessaire
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', folder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Générer un nom de fichier unique
        const ext      = filename ? path.extname(filename) : '.jpg';
        const name     = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const filePath = path.join(uploadDir, name);

        // Écrire le fichier
        fs.writeFileSync(filePath, buffer);

        // Retourner l'URL relative publique
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        return `${appUrl}/uploads/${folder}/${name}`;
    }
}

module.exports = { uploadImage, isCloudinaryConfigured };
