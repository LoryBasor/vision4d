'use strict';

const express    = require('express');
const { body }   = require('express-validator');
const router     = express.Router();
const authCtrl   = require('../controllers/authController');

// Validation inscription
const registerValidation = [
    body('nom').trim().notEmpty().withMessage('Le nom est requis.'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
    body('telephone').trim().notEmpty().withMessage('Le téléphone est requis.'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe : 6 caractères minimum.'),
    body('confirm_password').custom((val, { req }) => {
        if (val !== req.body.password) throw new Error('Les mots de passe ne correspondent pas.');
        return true;
    }),
];

// Validation connexion
const loginValidation = [
    body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
    body('password').notEmpty().withMessage('Mot de passe requis.'),
];

router.get('/inscription',  authCtrl.showRegister);
router.post('/inscription',  registerValidation, authCtrl.register);
router.get('/connexion',    authCtrl.showLogin);
router.post('/connexion',    loginValidation, authCtrl.login);
router.get('/deconnexion',  authCtrl.logout);

// Note: /admin/connexion et /admin/deconnexion sont dans adminRoutes.js

module.exports = router;
