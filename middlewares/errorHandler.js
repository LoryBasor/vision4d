'use strict';

/**
 * Gestionnaire d'erreurs global
 */
const errorHandler = (err, req, res, next) => {
    console.error('[ERROR]', err.code || err.status || 500, err.message);

    // ── Erreur CSRF ──────────────────────────────────────────────────────────
    // Se produit quand le formulaire ne contient pas le bon token _csrf.
    // Causes fréquentes :
    //   - Le champ <input name="_csrf"> est absent du formulaire
    //   - La session a expiré entre le chargement de la page et l'envoi
    //   - L'utilisateur a ouvert plusieurs onglets (tokens différents)
    if (err.code === 'EBADCSRFTOKEN') {
        console.warn('[CSRF] Token invalide depuis:', req.ip, '— route:', req.originalUrl);
        // Retourner sur la page précédente avec un message d'erreur
        req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
        return res.redirect(req.get('Referrer') || '/');
    }

    // ── Erreur 404 ───────────────────────────────────────────────────────────
    if (err.status === 404 || err.statusCode === 404) {
        return res.status(404).render('client/error', {
            title:   'Page introuvable',
            message: 'La page que vous cherchez n\'existe pas.',
            code:    404,
        });
    }

    // ── Erreur générique ─────────────────────────────────────────────────────
    const code = err.status || err.statusCode || 500;
    res.status(code).render('client/error', {
        title:   code === 500 ? 'Erreur serveur' : 'Erreur',
        message: code === 500 ? 'Une erreur interne est survenue.' : (err.message || 'Erreur.'),
        code,
    });
};

/**
 * Middleware 404 — appelé quand aucune route ne correspond
 */
const notFound = (req, res) => {
    res.status(404).render('client/error', {
        title:   'Page introuvable',
        message: 'La page que vous cherchez n\'existe pas.',
        code:    404,
    });
};

module.exports = { errorHandler, notFound };
