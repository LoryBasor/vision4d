-- ============================================================
-- VISION 4D — Schéma de base de données
-- Canal+ Paiement par tranches
-- ============================================================

CREATE DATABASE IF NOT EXISTS vision4d CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vision4d;

-- ============================================================
-- TABLE: admins
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    avatar      VARCHAR(500) DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: users (clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    telephone       VARCHAR(20) NOT NULL,
    password        VARCHAR(255) NOT NULL,
    numero_decodeur VARCHAR(50) DEFAULT NULL,
    avatar          VARCHAR(500) DEFAULT NULL,
    is_active       TINYINT(1) DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_telephone (telephone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: formules (Canal+ plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS formules (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL,
    code        VARCHAR(50) NOT NULL UNIQUE,
    prix        DECIMAL(10,2) NOT NULL,
    description TEXT DEFAULT NULL,
    is_active   TINYINT(1) DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertion des formules Canal+
INSERT INTO formules (nom, code, prix, description) VALUES
('ACCESS',      'ACCESS',      5000,  'Formule d''entrée avec les chaînes essentielles Canal+'),
('ESSENTIEL+',  'ESSENTIEL',   8000,  'Formule intermédiaire avec plus de chaînes et de contenus'),
('TOUT CANAL+', 'TOUT_CANAL',  15000, 'Accès complet à toutes les chaînes Canal+')
ON DUPLICATE KEY UPDATE prix = VALUES(prix);

-- ============================================================
-- TABLE: subscriptions (abonnements)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    formule_id          INT UNSIGNED NOT NULL,
    nombre_tranches     TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Nombre de tranches (1 à 3)',
    montant_total       DECIMAL(10,2) NOT NULL,
    montant_par_tranche DECIMAL(10,2) NOT NULL,
    tranches_payees     TINYINT UNSIGNED DEFAULT 0,
    statut              ENUM('en_attente_paiement','en_cours','complete','annulee','expiree') DEFAULT 'en_attente_paiement',
    date_debut          DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_fin_prevue     DATETIME DEFAULT NULL,
    notes               TEXT DEFAULT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (formule_id) REFERENCES formules(id) ON DELETE RESTRICT,
    INDEX idx_user_id (user_id),
    INDEX idx_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: installments (tranches de paiement)
-- ============================================================
CREATE TABLE IF NOT EXISTS installments (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id     INT UNSIGNED NOT NULL,
    user_id             INT UNSIGNED NOT NULL,
    numero_tranche      TINYINT UNSIGNED NOT NULL COMMENT 'Numéro de la tranche (1, 2, 3)',
    montant             DECIMAL(10,2) NOT NULL,
    statut              ENUM('en_attente','paye','expire') DEFAULT 'en_attente',
    date_limite         DATETIME NOT NULL COMMENT 'Date limite de paiement',
    date_paiement       DATETIME DEFAULT NULL,
    transaction_id      VARCHAR(255) DEFAULT NULL COMMENT 'ID Monetbil',
    payment_token       VARCHAR(255) DEFAULT NULL,
    payment_ref         VARCHAR(255) DEFAULT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_statut (statut),
    INDEX idx_transaction_id (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: products (boutique)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom         VARCHAR(200) NOT NULL,
    description TEXT DEFAULT NULL,
    prix        DECIMAL(10,2) NOT NULL,
    image_url   VARCHAR(500) DEFAULT NULL,
    image_id    VARCHAR(255) DEFAULT NULL COMMENT 'Cloudinary public_id',
    categorie   VARCHAR(100) DEFAULT 'general',
    stock       INT DEFAULT 0,
    is_active   TINYINT(1) DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categorie (categorie),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Produits de démonstration
INSERT INTO products (nom, description, prix, categorie, stock) VALUES
('Décodeur Canal+ SD',    'Décodeur standard définition pour réception satellite Canal+',     45000, 'decodeur',   10),
('Décodeur Canal+ HD',    'Décodeur haute définition avec accès à tous les services Canal+',  85000, 'decodeur',   5),
('Parabole 60cm Offset',  'Antenne parabolique 60cm offset pour réception Canal+',            25000, 'parabole',   15),
('Parabole 80cm Premium', 'Antenne parabolique 80cm pour zone difficile de réception',        35000, 'parabole',   8),
('Câble coaxial 10m',     'Câble coaxial haute qualité pour installation satellite',          5000,  'accessoire', 50),
('Support mural parabole','Support de fixation mural pour antenne parabolique',               8000,  'accessoire', 20)
ON DUPLICATE KEY UPDATE nom = VALUES(nom);

-- ============================================================
-- TABLE: articles (blog / actualités)
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id    INT UNSIGNED NOT NULL,
    titre       VARCHAR(300) NOT NULL,
    slug        VARCHAR(350) NOT NULL UNIQUE,
    contenu     LONGTEXT NOT NULL,
    image_url   VARCHAR(500) DEFAULT NULL,
    image_id    VARCHAR(255) DEFAULT NULL,
    type        ENUM('article','promotion','actualite') DEFAULT 'article',
    is_published TINYINT(1) DEFAULT 0,
    published_at DATETIME DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
    INDEX idx_type (type),
    INDEX idx_is_published (is_published),
    FULLTEXT idx_search (titre, contenu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: orders (achats boutique)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    quantite        INT UNSIGNED DEFAULT 1,
    montant_total   DECIMAL(10,2) NOT NULL,
    statut          ENUM('en_attente','paye','annule') DEFAULT 'en_attente',
    transaction_id  VARCHAR(255) DEFAULT NULL,
    payment_token   VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_user_id (user_id),
    INDEX idx_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: notifications (logs WhatsApp/système)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED DEFAULT NULL,
    type        VARCHAR(100) NOT NULL,
    message     TEXT NOT NULL,
    statut      ENUM('envoye','echec','en_attente') DEFAULT 'en_attente',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: tarif_tranches (gestion admin des frais)
-- ============================================================
CREATE TABLE IF NOT EXISTS tarif_tranches (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre_tranches TINYINT UNSIGNED NOT NULL UNIQUE,
    frais_pourcent  DECIMAL(5,2) DEFAULT 0 COMMENT 'Frais supplémentaires en %',
    description     VARCHAR(255) DEFAULT NULL,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tarif_tranches (nombre_tranches, frais_pourcent, description) VALUES
(1, 0.00,  'Paiement en une fois — aucun frais'),
(2, 2.00,  'Paiement en 2 tranches — 2% de frais'),
(3, 5.00,  'Paiement en 3 tranches — 5% de frais')
ON DUPLICATE KEY UPDATE frais_pourcent = VALUES(frais_pourcent);


-- ============================================================
-- MIGRATION : Ajouter le statut 'en_attente_paiement'
-- À exécuter si la base de données existait avant cette mise à jour
-- ============================================================
-- ALTER TABLE subscriptions
--     MODIFY COLUMN statut
--     ENUM('en_attente_paiement','en_cours','complete','annulee','expiree')
--     DEFAULT 'en_attente_paiement';
--
-- Pour appliquer : décommentez les lignes ci-dessus et exécutez dans MySQL.
