# VISION 4D — Application de paiement Canal+ par tranches

> Application web professionnelle permettant aux clients de souscrire et payer leurs abonnements Canal+ en **1 à 3 tranches**, avec notifications WhatsApp et paiement via Monetbil.

---

## 📋 Table des matières

- [Aperçu](#aperçu)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Lancement](#lancement)
- [Fonctionnalités](#fonctionnalités)
- [API Paiement (Monetbil)](#api-paiement-monetbil)
- [WhatsApp](#whatsapp)
- [Panel Admin](#panel-admin)
- [Sécurité](#sécurité)
- [Structure du projet](#structure-du-projet)

---

## Aperçu

VISION 4D est une application web full-stack qui permet à des clients de :
- Créer un compte et gérer leur profil
- Souscrire à une formule Canal+ (ACCESS, ESSENTIEL+, TOUT CANAL+)
- Payer en **1, 2 ou 3 tranches** via Mobile Money (Monetbil)
- Suivre leur progression de paiement
- Acheter du matériel (décodeurs, paraboles, accessoires)

---

## Stack technique

| Couche      | Technologie                        |
|-------------|-----------------------------------|
| Runtime     | Node.js ≥ 16                       |
| Framework   | Express.js 4.x                     |
| Base de données | MySQL 8.x                      |
| Templates   | EJS (Embedded JavaScript)          |
| Auth        | JWT + express-session              |
| Paiement    | Monetbil (Mobile Money Cameroun)   |
| Notifications | whatsapp-web.js                  |
| Uploads     | Multer + Cloudinary                |
| Sécurité    | Helmet, CSRF, bcrypt, express-validator |
| CSS         | CSS3 custom (Syne + DM Sans)       |
| JS Frontend | Vanilla JavaScript                 |

---

## Architecture

```
vision4d/
├── config/
│   ├── database.js         # Pool de connexions MySQL
│   ├── cloudinary.js       # Configuration Cloudinary
│   ├── multer.js           # Configuration upload fichiers
│   ├── schema.sql          # Schéma complet de la BDD
│   └── setup.js            # Script d'initialisation
├── models/                 # Couche d'accès aux données (DAO)
│   ├── User.js
│   ├── Admin.js
│   ├── Subscription.js
│   ├── Installment.js
│   ├── Product.js
│   └── Article.js
├── controllers/            # Logique métier
│   ├── authController.js
│   ├── clientController.js
│   ├── subscriptionController.js
│   ├── productController.js
│   ├── articleController.js
│   └── adminController.js
├── services/               # Services externes
│   ├── monetbilService.js
│   ├── whatsappService.js
│   └── subscriptionService.js
├── routes/                 # Définition des routes
│   ├── authRoutes.js
│   ├── clientRoutes.js
│   ├── adminRoutes.js
│   └── publicRoutes.js
├── middlewares/
│   ├── authMiddleware.js   # Vérification JWT client
│   ├── adminMiddleware.js  # Vérification JWT admin
│   └── errorHandler.js
├── views/                  # Templates EJS
│   ├── layouts/            # main.ejs, admin.ejs
│   ├── partials/           # navbar.ejs, footer.ejs
│   ├── client/             # Pages client
│   └── admin/              # Pages admin
├── public/
│   ├── css/style.css       # CSS client
│   ├── css/admin.css       # CSS admin
│   ├── js/app.js           # JS client
│   └── js/admin.js         # JS admin
├── app.js                  # Configuration Express
├── server.js               # Point d'entrée
├── package.json
└── .env.example
```

---

## Prérequis

- **Node.js** ≥ 16.0.0
- **MySQL** 8.x (ou MariaDB 10.x)
- **Compte Cloudinary** (uploads images)
- **Compte Monetbil** (paiements Mobile Money)
- **npm** ou **yarn**
- (Optionnel) Compte WhatsApp Business pour les notifications

---

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-repo/vision4d.git
cd vision4d
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Éditez le fichier `.env` avec vos valeurs (voir [Configuration](#configuration)).

### 4. Créer la base de données et initialiser

```bash
# S'assurer que MySQL est démarré
# Puis lancer le script de setup
npm run setup
```

Ce script :
- Crée la base de données `vision4d`
- Applique toutes les tables
- Insère les formules Canal+
- Crée le compte admin par défaut
- Insère des produits de démonstration

---

## Configuration

Éditez le fichier `.env` :

```env
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Base de données MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=votre_mot_de_passe_mysql
DB_NAME=vision4d

# JWT (clé secrète longue et aléatoire)
JWT_SECRET=changez_cette_cle_en_production_minimum_32_caracteres
JWT_EXPIRES_IN=7d

# Session
SESSION_SECRET=autre_cle_secrete_pour_les_sessions

# Bcrypt (10-12 recommandé)
BCRYPT_ROUNDS=12

# Cloudinary (https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret

# Monetbil (https://www.monetbil.com)
MONETBIL_SERVICE_KEY=votre_service_key
MONETBIL_SERVICE_SECRET=votre_service_secret
MONETBIL_NOTIFY_URL=https://votredomaine.com/payment/notify
MONETBIL_RETURN_URL=https://votredomaine.com/payment/return

# WhatsApp (numéro admin avec indicatif pays, sans +)
WHATSAPP_ADMIN_NUMBER=237600000000

# Admin par défaut
ADMIN_EMAIL=admin@vision4d.cm
ADMIN_PASSWORD=Admin@2024
ADMIN_NAME=Administrateur

# Délai paiement tranches (jours)
PAYMENT_DEADLINE_DAYS=15
```

### Configuration Monetbil

1. Créez un compte sur [monetbil.com](https://www.monetbil.com)
2. Créez un service de paiement
3. Récupérez votre `Service Key` et `Service Secret`
4. Configurez l'URL de notification webhook : `https://votredomaine.com/payment/notify`
5. Configurez l'URL de retour : `https://votredomaine.com/payment/return`

### Configuration Cloudinary

1. Créez un compte sur [cloudinary.com](https://cloudinary.com)
2. Récupérez `Cloud Name`, `API Key`, `API Secret` depuis le dashboard
3. Renseignez ces valeurs dans le `.env`

---

## Lancement

### Mode développement (avec rechargement automatique)

```bash
npm run dev
```

### Mode production

```bash
NODE_ENV=production npm start
```

L'application sera disponible sur :
- **Site client :** http://localhost:3000
- **Panel admin :** http://localhost:3000/admin/connexion

---

## Fonctionnalités

### Côté Client

| Fonctionnalité | Route |
|---------------|-------|
| Page d'accueil (publique) | `GET /` |
| Blog & Actualités | `GET /blog` |
| Boutique | `GET /boutique` |
| Inscription | `GET/POST /inscription` |
| Connexion | `GET/POST /connexion` |
| Mon compte | `GET /compte` |
| Abonnements & Tranches | `GET /abonnement` |
| Souscrire | `POST /abonnement/souscrire` |
| Payer une tranche | `POST /abonnement/payer/:id` |
| Historique | `GET /compte/historique` |

### Formules Canal+

| Formule | Prix | Code |
|---------|------|------|
| ACCESS | 5 000 FCFA | `ACCESS` |
| ESSENTIEL+ | 8 000 FCFA | `ESSENTIEL` |
| TOUT CANAL+ | 15 000 FCFA | `TOUT_CANAL` |

### Règles de paiement par tranches

- **1 tranche** : 0% de frais — paiement immédiat
- **2 tranches** : +2% de frais — 15 jours entre chaque tranche
- **3 tranches** : +5% de frais — 15 jours entre chaque tranche

> Le délai de 15 jours est configurable via `PAYMENT_DEADLINE_DAYS` dans le `.env`.

### Panel Admin

| Fonctionnalité | Route |
|---------------|-------|
| Dashboard | `GET /admin/dashboard` |
| Liste clients | `GET /admin/clients` |
| Détail client | `GET /admin/clients/:id` |
| Abonnements | `GET /admin/abonnements` |
| Détail abonnement | `GET /admin/abonnements/:id` |
| Articles CRUD | `GET/POST /admin/articles` |
| Boutique CRUD | `GET/POST /admin/boutique` |
| Tarifs tranches | `GET/POST /admin/tarifs` |
| Profil admin | `GET/POST /admin/profil` |

---

## API Paiement (Monetbil)

### Flux de paiement

```
Client → Choisit formule + tranches
       → POST /abonnement/souscrire
       → Création abonnement + tranches en BDD
       → Génération token unique
       → Redirection vers widget Monetbil
       → Client paie via Mobile Money
       → Monetbil envoie webhook → POST /payment/notify
       → Vérification + mise à jour tranche en BDD
       → Notification WhatsApp admin
       → Client redirigé → GET /payment/return
```

### Webhook Monetbil

Le endpoint `POST /payment/notify` reçoit :

```json
{
  "transaction_UUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "1",
  "payment_ref": "V4D-12-T1-ABCD1234",
  "item_ref": "V4D-12-T1-ABCD1234",
  "amount": "2667"
}
```

> **Note :** Ce endpoint est exclu de la protection CSRF car il est appelé par Monetbil.

---

## WhatsApp

Le service WhatsApp utilise `whatsapp-web.js`. Au premier démarrage :

1. Un QR Code apparaît dans le terminal
2. Scannez-le avec WhatsApp sur votre téléphone admin
3. La session est sauvegardée localement (dossier `.wwebjs_auth/`)
4. Les notifications sont envoyées automatiquement

**Mode dégradé** : Si WhatsApp n'est pas connecté, les messages sont loggés dans la console et les liens `wa.me/` fonctionnent quand même pour rediriger le client.

### Types de notifications

```
🆕 NOUVEL ABONNEMENT → à la souscription
💳 PAIEMENT TRANCHE  → à chaque paiement confirmé
🛍️ ACHAT BOUTIQUE    → à chaque achat de produit
```

---

## Sécurité

| Mesure | Implémentation |
|--------|---------------|
| Mots de passe | bcrypt (rounds: 12) |
| Authentification | JWT (7j) + cookies httpOnly |
| Protection CSRF | csurf middleware |
| En-têtes HTTP | Helmet.js |
| Validation | express-validator |
| Injection SQL | Requêtes paramétrées (mysql2) |
| XSS | EJS auto-escape + Helmet CSP |
| Rate limiting | À ajouter en production |

---

## Structure base de données

### Tables principales

| Table | Description |
|-------|-------------|
| `users` | Clients de la plateforme |
| `admins` | Administrateurs |
| `formules` | Formules Canal+ disponibles |
| `subscriptions` | Abonnements clients |
| `installments` | Tranches de paiement |
| `products` | Catalogue boutique |
| `articles` | Blog, promotions, actualités |
| `orders` | Commandes boutique |
| `tarif_tranches` | Frais par nombre de tranches |
| `notifications` | Log des notifications |

---

## Déploiement en production

### Variables à changer absolument

```env
NODE_ENV=production
JWT_SECRET=cle_aleatoire_longue_et_complexe_minimum_64_chars
SESSION_SECRET=autre_cle_aleatoire_differente
APP_URL=https://votre-domaine.com
MONETBIL_NOTIFY_URL=https://votre-domaine.com/payment/notify
MONETBIL_RETURN_URL=https://votre-domaine.com/payment/return
```

### Recommandations production

- Utiliser **PM2** pour la gestion du processus
- Configurer **Nginx** comme reverse proxy
- Activer **HTTPS** (Let's Encrypt)
- Configurer un **firewall** (UFW)
- Ajouter **rate limiting** (express-rate-limit)
- Mettre en place des **backups** MySQL automatiques

```bash
# Installer PM2
npm install -g pm2

# Démarrer l'application
pm2 start server.js --name vision4d

# Démarrage automatique
pm2 startup
pm2 save
```

---

## Licence

Projet développé par Vision 4D. Tous droits réservés.

---

## Support

Pour toute question technique, contactez l'équipe de développement.
