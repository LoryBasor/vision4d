'use strict';

const express     = require('express');
const router      = express.Router();
const adminAuth   = require('../middlewares/adminMiddleware');
const upload      = require('../config/multer');
const adminCtrl   = require('../controllers/adminController');
const articleCtrl = require('../controllers/articleController');
const authCtrl    = require('../controllers/authController');

// ─── ROUTES PUBLIQUES ADMIN (sans auth) ──────────────────────────────────────
// Ces routes DOIVENT être déclarées AVANT router.use(adminAuth)
router.get('/connexion',  authCtrl.showAdminLogin);
router.post('/connexion', authCtrl.adminLogin);
router.get('/deconnexion', authCtrl.adminLogout);

// ─── MIDDLEWARE AUTH (appliqué à toutes les routes suivantes) ─────────────────
router.use(adminAuth);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/dashboard', adminCtrl.dashboard);

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
router.get('/clients',                              adminCtrl.listClients);
router.get('/clients/:id',                          adminCtrl.showClient);
router.post('/clients/:id/toggle-active',           adminCtrl.toggleClientActive);
router.post('/clients/:id/supprimer-abonnement',    adminCtrl.deleteClientSubscription);

// ─── ABONNEMENTS ──────────────────────────────────────────────────────────────
router.get('/abonnements',                          adminCtrl.listSubscriptions);
router.get('/abonnements/:id',                      adminCtrl.showSubscription);
router.post('/abonnements/:id/changer-statut',      adminCtrl.changeSubscriptionStatut);
router.post('/abonnements/:id/changer-formule',     adminCtrl.changeSubscriptionFormule);
router.post('/abonnements/:id/supprimer',           adminCtrl.deleteSubscription);

// ─── ARTICLES ─────────────────────────────────────────────────────────────────
router.get('/articles',                             articleCtrl.adminList);
router.get('/articles/nouveau',                     articleCtrl.showCreateForm);
router.post('/articles/nouveau',                    upload.single('image'), articleCtrl.create);
router.get('/articles/:id/modifier',                articleCtrl.showEditForm);
router.post('/articles/:id/modifier',               upload.single('image'), articleCtrl.update);
router.post('/articles/:id/publier',                articleCtrl.togglePublish);
router.post('/articles/:id/supprimer',              articleCtrl.delete);

// ─── BOUTIQUE ─────────────────────────────────────────────────────────────────
router.get('/boutique',                             adminCtrl.listProducts);
router.get('/boutique/nouveau',                     adminCtrl.showProductForm);
router.post('/boutique/nouveau',                    upload.single('image'), adminCtrl.createProduct);
router.get('/boutique/:id/modifier',                adminCtrl.showEditProduct);
router.post('/boutique/:id/modifier',               upload.single('image'), adminCtrl.updateProduct);
router.post('/boutique/:id/supprimer',              adminCtrl.deleteProduct);

// ─── HISTORIQUE ───────────────────────────────────────────────────────────────
router.get('/historique', adminCtrl.showHistory);

// ─── FORMULES ─────────────────────────────────────────────────────────────────
router.get('/formules',                      adminCtrl.listFormules);
router.get('/formules/nouvelle',             adminCtrl.showCreateFormule);
router.post('/formules/nouvelle',            adminCtrl.createFormule);
router.get('/formules/:id/modifier',         adminCtrl.showEditFormule);
router.post('/formules/:id/modifier',        adminCtrl.updateFormule);
router.post('/formules/:id/toggle',          adminCtrl.toggleFormule);
router.post('/formules/:id/supprimer',       adminCtrl.deleteFormule);
router.post('/formules/:id/prix',            adminCtrl.updateFormulePrix);

// ─── TARIFS ───────────────────────────────────────────────────────────────────
router.get('/tarifs',                               adminCtrl.showTarifs);
router.post('/tarifs',                              adminCtrl.updateTarifs);

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────
router.get('/whatsapp',          adminCtrl.showWhatsApp);
router.post('/whatsapp/restart', adminCtrl.restartWhatsApp);
router.post('/whatsapp/test',    adminCtrl.testWhatsApp);

// ─── PROFIL ───────────────────────────────────────────────────────────────────
router.get('/profil',                               adminCtrl.showProfile);
router.post('/profil',                              upload.single('avatar'), adminCtrl.updateProfile);
router.post('/profil/mot-de-passe',                 adminCtrl.updateAdminPassword);

module.exports = router;
