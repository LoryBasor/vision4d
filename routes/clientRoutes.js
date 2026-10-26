'use strict';

const express      = require('express');
const router       = express.Router();
const { body }     = require('express-validator');
const auth         = require('../middlewares/authMiddleware');
const upload       = require('../config/multer');
const clientCtrl   = require('../controllers/clientController');
const subCtrl      = require('../controllers/subscriptionController');
const productCtrl  = require('../controllers/productController');

// Routes protégées nécessitant une authentification client
router.use('/compte',     auth);
router.use('/abonnement', auth);

// Compte
router.get('/compte',                   clientCtrl.showAccount);
router.post('/compte/profil',           upload.single('avatar'), clientCtrl.updateProfile);
router.post('/compte/mot-de-passe',     clientCtrl.updatePassword);
router.post('/compte/decodeur',         clientCtrl.setDecodeur);
router.get('/compte/historique',        clientCtrl.showHistory);

// Abonnements
router.get('/abonnement',               subCtrl.showPlans);
router.post('/abonnement/souscrire',    subCtrl.subscribe);
router.post('/abonnement/payer/:installment_id', subCtrl.payInstallment);

// Boutique (achat)
router.post('/boutique/:id/acheter',    auth, productCtrl.buyProduct);

// Annuler un abonnement
router.post('/abonnement/:id/annuler',  subCtrl.cancelSubscription);

// NOTE: /payment/return est dans publicRoutes.js (pas besoin d'auth)

module.exports = router;
