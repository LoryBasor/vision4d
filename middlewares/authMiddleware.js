'use strict';

/**
 * Middleware d'authentification client.
 * L'utilisateur est déjà résolu dans app.js (res.locals.user / req.user).
 * Ce middleware vérifie simplement qu'un utilisateur est connecté.
 * Si non connecté, il redirige vers /connexion.
 */
const authMiddleware = (req, res, next) => {
    if (!req.user) {
        req.flash('error', 'Veuillez vous connecter pour accéder à cette page.');
        return res.redirect('/connexion');
    }
    next();
};

module.exports = authMiddleware;
