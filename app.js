'use strict';

const express      = require('express');
const path         = require('path');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const session      = require('express-session');
const flash        = require('connect-flash');
const crypto       = require('crypto');
const jwt          = require('jsonwebtoken');
require('dotenv').config();

const publicRoutes = require('./routes/publicRoutes');
const authRoutes   = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const adminRoutes  = require('./routes/adminRoutes');

const subCtrl     = require('./controllers/subscriptionController');
const productCtrl = require('./controllers/productController');

const { errorHandler, notFound } = require('./middlewares/errorHandler');
const User  = require('./models/User');
const Admin = require('./models/Admin');

const app = express();

// ─── SÉCURITÉ ─────────────────────────────────────────────────────────────────
app.use(helmet({
    // On désactive le CSP — il bloque les redirections vers Monetbil
    // dont le domaine peut varier (monetbil.com, monetbil.africa, monetbil.cq...)
    // La sécurité est assurée par d'autres middlewares (CSRF, validation, bcrypt)
    contentSecurityPolicy: false,
}));

// ─── TEMPLATE ENGINE ──────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── PARSING & STATIC ─────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SESSION ──────────────────────────────────────────────────────────────────
app.use(session({
    secret:            process.env.SESSION_SECRET || 'vision4d_session_secret_change_me',
    resave:            false,
    saveUninitialized: true,  // true pour que le csrfToken soit sauvegardé dès le GET
    cookie: {
        secure:   process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge:   24 * 60 * 60 * 1000,
        sameSite: 'lax',
    },
}));

app.use(flash());

// ─── WEBHOOKS MONETBIL (avant CSRF) ──────────────────────────────────────────
app.post('/payment/notify',       subCtrl.paymentNotify);
app.post('/payment/notify-order', productCtrl.orderNotify);

// ─── CSRF CUSTOM ─────────────────────────────────────────────────────────────
// On n'utilise plus csurf (déprécié et incompatible avec multer/multipart).
// Notre implémentation :
//   - Génération d'un token aléatoire stocké en session
//   - Vérification sur toutes les requêtes POST/PUT/DELETE/PATCH
//   - Compatible avec multipart/form-data (multer lit d'abord, on vérifie après)
//
// NOTE IMPORTANTE : les routes multipart (/compte/profil, /admin/...) doivent
// appeler csrfVerify() APRÈS multer dans leur route handler, pas via middleware global.
// C'est pourquoi on expose à la fois le middleware global (pour les forms normaux)
// et une fonction utilitaire pour les routes multipart.

function generateCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
}

// Middleware : injecte le token dans res.locals pour les vues
app.use((req, res, next) => {
    const token       = generateCsrfToken(req);
    res.locals.csrfToken = token;
    next();
});

// Middleware : vérifie le token sur les méthodes mutantes (sauf routes multipart
// qui font leur propre vérification après multer)
const MULTIPART_ROUTES = [
    '/compte/profil',
    '/admin/profil',
    '/admin/boutique/nouveau',
    '/admin/boutique/',       // inclut /modifier
    '/admin/articles/nouveau',
    '/admin/articles/',       // inclut /modifier
];

app.use((req, res, next) => {
    if (!['POST','PUT','DELETE','PATCH'].includes(req.method)) return next();

    // Exclure les webhooks Monetbil
    if (req.path.startsWith('/payment/')) return next();

    // Exclure les routes multipart — elles vérifient elles-mêmes après multer
    const isMultipart = MULTIPART_ROUTES.some(r => req.path.startsWith(r));
    if (isMultipart) return next();

    const sessionToken = req.session.csrfToken;
    // Pour les requêtes JSON (fetch API), le token vient du header x-csrf-token
    // Pour les formulaires HTML classiques, il vient du body (_csrf)
    const bodyToken = req.headers['x-csrf-token']
                   || req.headers['x-xsrf-token']
                   || req.body?._csrf;

    if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
        console.warn(`[CSRF] Token invalide — route: ${req.method} ${req.path} | IP: ${req.ip}`);
        req.flash('error', 'Formulaire expiré. Veuillez réessayer.');
        return res.redirect(req.get('Referrer') || '/');
    }

    next();
});

// Exporter la fonction de vérification pour les routes multipart
app.locals.verifyCsrf = function(req, res) {
    const sessionToken = req.session.csrfToken;
    const bodyToken = req.headers['x-csrf-token']
                   || req.headers['x-xsrf-token']
                   || req.body?._csrf;
    return sessionToken && bodyToken && sessionToken === bodyToken;
};

// ─── MIDDLEWARE GLOBAL — variables injectées dans TOUTES les vues ──────────────
app.use(async (req, res, next) => {
    // Flash messages (toujours des tableaux)
    res.locals.success     = req.flash('success') || [];
    res.locals.error       = req.flash('error')   || [];
    res.locals.APP_URL     = process.env.APP_URL   || 'http://localhost:3000';
    res.locals.currentPath = req.path;

    // Injecter user connecté sur toutes les routes (navbar)
    res.locals.user  = null;
    res.locals.admin = null;

    try {
        const token = req.cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const user    = await User.findById(decoded.id);
            if (user && user.is_active) {
                res.locals.user = user;
                req.user        = user;
            }
        }
    } catch (e) { /* token invalide — silencieux */ }

    try {
        const adminToken = req.cookies?.admin_token;
        if (adminToken) {
            const decoded = jwt.verify(adminToken, process.env.JWT_SECRET || 'default_secret');
            if (decoded.isAdmin) {
                const admin = await Admin.findById(decoded.id);
                if (admin) {
                    res.locals.admin = admin;
                    req.admin        = admin;
                }
            }
        }
    } catch (e) { /* silencieux */ }

    next();
});

// ─── DEBUG — À retirer après diagnostic ──────────────────────────────────────
app.use((req, res, next) => {
    const origRedirect = res.redirect.bind(res);
    res.redirect = function(url) {
        console.log(`[REDIRECT] ${req.method} ${req.originalUrl} → ${url} | admin: ${req.admin ? req.admin.email : 'null'} | user: ${req.user ? req.user.email : 'null'}`);
        return origRedirect(url);
    };
    next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/',      publicRoutes);
app.use('/',      authRoutes);
app.use('/',      clientRoutes);
app.use('/admin', adminRoutes);

// ─── 404 & ERREURS ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
