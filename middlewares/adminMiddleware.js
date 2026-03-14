'use strict';

/**
 * Middleware d'authentification admin.
 * L'admin est résolu dans app.js (res.locals.admin / req.admin).
 * Ce middleware est appliqué APRÈS les routes publiques admin
 * (connexion, déconnexion) dans adminRoutes.js.
 */
const adminMiddleware = (req, res, next) => {
    if (!req.admin) {
        req.flash('error', 'Accès réservé aux administrateurs.');
        return res.redirect('/admin/connexion');
    }
    next();
};

module.exports = adminMiddleware;
