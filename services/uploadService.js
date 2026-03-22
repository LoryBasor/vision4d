'use strict';

const fs   = require('fs');
const path = require('path');
require('dotenv').config();

function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY    &&
        process.env.CLOUDINARY_API_SECRET &&
        process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
    );
}

/**
 * Extraire le public_id Cloudinary depuis une URL
 * Ex: https://res.cloudinary.com/moncloud/image/upload/v123/vision4d/avatars/abc.jpg
 * → vision4d/avatars/abc
 */
function extractPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    try {
        // Prendre tout après /upload/v.../  ou /upload/
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

/**
 * Supprimer une ancienne image Cloudinary si elle existe
 * @param {string} oldUrl - URL Cloudinary de l'ancienne image
 */
async function deleteOldImage(oldUrl) {
    if (!oldUrl || !isCloudinaryConfigured()) return;

    const publicId = extractPublicId(oldUrl);
    if (!publicId) return;

    // Ne jamais supprimer les images par défaut ou placeholder
    const protectedPatterns = ['default', 'placeholder', 'avatar_default'];
    if (protectedPatterns.some(p => publicId.includes(p))) return;

    try {
        const cloudinary = require('../config/cloudinary');
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        console.log(`[Upload] 🗑️ Ancienne image supprimée: ${publicId}`);
    } catch (err) {
        // Silencieux — si la suppression échoue, ce n'est pas bloquant
        console.warn(`[Upload] Impossible de supprimer l'ancienne image: ${err.message}`);
    }
}

/**
 * Supprimer une image locale (fallback)
 */
function deleteLocalImage(url) {
    if (!url || url.includes('cloudinary.com')) return;
    try {
        const appUrl  = process.env.APP_URL || 'http://localhost:3000';
        const relPath = url.replace(appUrl, '');
        const absPath = path.join(__dirname, '..', 'public', relPath);
        if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
            console.log(`[Upload] 🗑️ Image locale supprimée: ${absPath}`);
        }
    } catch (err) {
        console.warn(`[Upload] Impossible de supprimer l'image locale: ${err.message}`);
    }
}

/**
 * Uploader une image et supprimer l'ancienne si elle existe
 *
 * @param {Buffer} buffer       - Buffer du fichier (req.file.buffer)
 * @param {string} folder       - Dossier de destination (ex: 'avatars', 'products')
 * @param {string} filename     - Nom de fichier original (pour l'extension)
 * @param {string} [oldUrl]     - URL de l'ancienne image à supprimer
 * @returns {Promise<string>}   - URL publique de la nouvelle image
 */
async function uploadImage(buffer, folder = 'uploads', filename = '', oldUrl = null) {
    if (!buffer) throw new Error('Buffer image manquant');

    let newUrl;

    if (isCloudinaryConfigured()) {
        // ── Upload Cloudinary ──────────────────────────────────────────────────
        const cloudinary = require('../config/cloudinary');
        newUrl = await new Promise((resolve, reject) => {
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

        // Supprimer l'ancienne image Cloudinary après succès
        if (oldUrl && oldUrl !== newUrl) {
            await deleteOldImage(oldUrl);
        }

    } else {
        // ── Fallback stockage local ────────────────────────────────────────────
        console.warn('[Upload] Cloudinary non configuré — stockage local utilisé');

        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', folder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const ext      = filename ? path.extname(filename) : '.jpg';
        const name     = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const filePath = path.join(uploadDir, name);
        fs.writeFileSync(filePath, buffer);

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        newUrl = `${appUrl}/uploads/${folder}/${name}`;

        // Supprimer l'ancienne image locale
        if (oldUrl && oldUrl !== newUrl) {
            deleteLocalImage(oldUrl);
        }
    }

    return newUrl;
}

module.exports = { uploadImage, deleteOldImage, isCloudinaryConfigured, extractPublicId };
