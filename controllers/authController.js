'use strict';

const jwt              = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User             = require('../models/User');
const Admin            = require('../models/Admin');

// ─── CLIENT AUTH ──────────────────────────────────────────────────────────────

const authController = {

    // GET /inscription
    showRegister(req, res) {
        res.render('client/register', { title: 'Inscription — Vision 4D', errors: [], old: {} });
    },

    // POST /inscription
    async register(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('client/register', {
                title:  'Inscription — Vision 4D',
                errors: errors.array(),
                old:    req.body,
            });
        }

        try {
            const { nom, prenom, email, telephone, password } = req.body;

            // Vérifier email unique
            const existing = await User.findByEmail(email);
            if (existing) {
                return res.render('client/register', {
                    title:  'Inscription — Vision 4D',
                    errors: [{ msg: 'Cet email est déjà utilisé.' }],
                    old:    req.body,
                });
            }

            await User.create({ nom, prenom, email, telephone, password });
            req.flash('success', 'Compte créé avec succès ! Vous pouvez vous connecter.');
            res.redirect('/connexion');
        } catch (err) {
            console.error('[Auth] Erreur inscription:', err);
            res.render('client/register', {
                title:  'Inscription — Vision 4D',
                errors: [{ msg: 'Une erreur est survenue. Veuillez réessayer.' }],
                old:    req.body,
            });
        }
    },

    // GET /connexion
    showLogin(req, res) {
        const token = req.cookies?.token;
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
                return res.redirect('/compte');
            } catch (e) {
                res.clearCookie('token');
            }
        }
        res.render('client/login', { title: 'Connexion — Vision 4D', errors: [], old: {} });
    },

    // POST /connexion
    async login(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('client/login', {
                title:  'Connexion — Vision 4D',
                errors: errors.array(),
                old:    req.body,
            });
        }

        try {
            const { email, password } = req.body;
            const user = await User.findByEmail(email);

            if (!user || !(await User.verifyPassword(password, user.password))) {
                return res.render('client/login', {
                    title:  'Connexion — Vision 4D',
                    errors: [{ msg: 'Email ou mot de passe incorrect.' }],
                    old:    req.body,
                });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure:   process.env.NODE_ENV === 'production',
                maxAge:   7 * 24 * 60 * 60 * 1000,
                sameSite: 'lax',
            });

            req.flash('success', `Bienvenue, ${user.prenom} !`);
            res.redirect('/compte');
        } catch (err) {
            console.error('[Auth] Erreur connexion:', err);
            res.render('client/login', {
                title:  'Connexion — Vision 4D',
                errors: [{ msg: 'Une erreur est survenue. Veuillez réessayer.' }],
                old:    req.body,
            });
        }
    },

    // GET /deconnexion
    logout(req, res) {
        res.clearCookie('token');
        req.flash('success', 'Vous avez été déconnecté.');
        res.redirect('/');
    },

    // ─── ADMIN AUTH ──────────────────────────────────────────────────────────

    // GET /admin/connexion
    // Cette route est dans adminRoutes.js AVANT router.use(adminAuth)
    // donc req.admin peut être null ici — c'est normal
    showAdminLogin(req, res) {
        // Si l'admin est déjà connecté (via app.js), le rediriger
        if (req.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin/login', {
            title:  'Admin — Connexion',
            errors: [],
            old:    {},
        });
    },

    // POST /admin/connexion
    async adminLogin(req, res) {
        try {
            const { email, password } = req.body;
            const admin = await Admin.findByEmail(email);

            if (!admin || !(await Admin.verifyPassword(password, admin.password))) {
                return res.render('admin/login', {
                    title:  'Admin — Connexion',
                    errors: [{ msg: 'Identifiants administrateur incorrects.' }],
                    old:    req.body,
                });
            }

            const token = jwt.sign(
                { id: admin.id, email: admin.email, isAdmin: true },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.cookie('admin_token', token, {
                httpOnly: true,
                secure:   process.env.NODE_ENV === 'production',
                maxAge:   8 * 60 * 60 * 1000,
                sameSite: 'lax',
            });

            res.redirect('/admin/dashboard');
        } catch (err) {
            console.error('[Auth] Erreur admin login:', err);
            res.render('admin/login', {
                title:  'Admin — Connexion',
                errors: [{ msg: 'Erreur serveur. Veuillez réessayer.' }],
                old:    req.body,
            });
        }
    },

    // GET /admin/deconnexion
    adminLogout(req, res) {
        res.clearCookie('admin_token');
        res.redirect('/admin/connexion');
    },
};

module.exports = authController;
