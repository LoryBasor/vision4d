'use strict';

const db = require('../config/database');

/**
 * Modèle Notification — source de vérité pour TOUTES les transactions
 *
 * Types :
 *   paiement_tranche   — paiement d'une tranche d'abonnement
 *   paiement_commande  — paiement d'un produit boutique
 *   souscription       — création d'un abonnement
 *   annulation         — annulation abonnement ou commande
 *   whatsapp           — message WhatsApp envoyé
 *   systeme            — événement système (expiration, etc.)
 *
 * Statuts :
 *   pending    — initié, en attente de confirmation Monetbil
 *   success    — paiement confirmé par webhook
 *   failed     — paiement échoué / rejeté
 *   cancelled  — annulé par l'utilisateur
 *   sent       — notification WhatsApp envoyée
 *   error      — erreur système
 */
class Notification {

    /**
     * Enregistrer une notification / transaction
     */
    static async create({
        user_id         = null,
        type,
        statut          = 'pending',
        montant         = null,
        reference       = null,
        transaction_id  = null,
        subscription_id = null,
        installment_id  = null,
        order_id        = null,
        details         = null,
        message         = null,
    }) {
        const detailsStr = details
            ? (typeof details === 'string' ? details : JSON.stringify(details))
            : null;

        // Générer un message lisible automatiquement si non fourni
        // (nécessaire car l'ancienne BDD peut avoir message TEXT NOT NULL)
        const autoMessage = message || (() => {
            const labels = {
                'paiement_tranche':  'Paiement tranche abonnement',
                'paiement_commande': 'Paiement commande boutique',
                'souscription':      'Nouvelle souscription',
                'annulation':        'Annulation abonnement',
                'whatsapp':          'Notification WhatsApp',
                'systeme':           'Événement système',
            };
            const base = labels[type] || type;
            const extra = montant ? ` — ${parseInt(montant).toLocaleString('fr-FR')} FCFA` : '';
            const ref   = reference ? ` (${reference})` : '';
            return base + extra + ref;
        })();

        const [result] = await db.query(
            `INSERT INTO notifications
             (user_id, type, statut, montant, reference, transaction_id,
              subscription_id, installment_id, order_id, details, message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, type, statut, montant, reference, transaction_id,
             subscription_id, installment_id, order_id, detailsStr, autoMessage]
        );
        return result.insertId;
    }

    /**
     * Mettre à jour le statut d'une notification existante (par référence)
     */
    static async updateByReference(reference, { statut, transaction_id = null, details = null }) {
        const detailsStr = details
            ? (typeof details === 'string' ? details : JSON.stringify(details))
            : null;

        await db.query(
            `UPDATE notifications
             SET statut = ?,
                 transaction_id = COALESCE(?, transaction_id),
                 details = COALESCE(?, details)
             WHERE reference = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [statut, transaction_id, detailsStr, reference]
        );
    }

    /**
     * Historique d'un utilisateur (toutes ses transactions financières)
     */
    static async findByUser(user_id, { limit = 50, offset = 0, type = null } = {}) {
        let where = 'WHERE n.user_id = ?';
        const params = [user_id];

        if (type) { where += ' AND n.type = ?'; params.push(type); }

        params.push(limit, offset);

        const [rows] = await db.query(
            `SELECT n.*,
                    -- Enrichir avec les données des entités liées
                    f.nom  as formule_nom,
                    p.nom  as product_nom,
                    p.image_url as product_image
             FROM notifications n
             LEFT JOIN subscriptions s ON s.id = n.subscription_id
             LEFT JOIN formules f      ON f.id = s.formule_id
             LEFT JOIN orders ord      ON ord.id = n.order_id
             LEFT JOIN products p      ON p.id = ord.product_id
             ${where}
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            params
        );
        return rows;
    }

    /**
     * Historique global pour l'admin — toutes les transactions
     */
    static async findAll({
        limit   = 50,
        offset  = 0,
        type    = null,
        statut  = null,
        search  = null,
        from    = null,
        to      = null,
    } = {}) {
        let where = "WHERE n.type IN ('paiement_tranche','paiement_commande','souscription','annulation')";
        const params = [];

        if (type)   { where += ' AND n.type = ?';                         params.push(type); }
        if (statut) { where += ' AND n.statut = ?';                       params.push(statut); }
        if (from)   { where += ' AND n.created_at >= ?';                  params.push(from); }
        if (to)     { where += ' AND n.created_at <= ?';                  params.push(to + ' 23:59:59'); }
        if (search) {
            where += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.telephone LIKE ? OR n.reference LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        params.push(limit, offset);

        const [rows] = await db.query(
            `SELECT n.*,
                    u.nom      as user_nom,
                    u.prenom   as user_prenom,
                    u.telephone,
                    f.nom      as formule_nom,
                    p.nom      as product_nom,
                    p.image_url as product_image
             FROM notifications n
             LEFT JOIN users u         ON u.id = n.user_id
             LEFT JOIN subscriptions s ON s.id = n.subscription_id
             LEFT JOIN formules f      ON f.id = s.formule_id
             LEFT JOIN orders ord      ON ord.id = n.order_id
             LEFT JOIN products p      ON p.id = ord.product_id
             ${where}
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            params
        );

        // Compter le total pour la pagination
        const countParams = params.slice(0, -2);
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total
             FROM notifications n
             LEFT JOIN users u ON u.id = n.user_id
             ${where}`,
            countParams
        );

        return { rows, total };
    }

    /**
     * Stats globales pour le dashboard admin
     */
    static async getStats() {
        const [[stats]] = await db.query(`
            SELECT
                -- Tranches abonnement
                SUM(type = 'paiement_tranche' AND statut = 'success')   as tranches_ok,
                SUM(type = 'paiement_tranche' AND statut = 'failed')    as tranches_ko,
                SUM(type = 'paiement_tranche' AND statut = 'cancelled') as tranches_cancel,
                SUM(type = 'paiement_tranche' AND statut = 'pending')   as tranches_pending,
                COALESCE(SUM(CASE WHEN type='paiement_tranche' AND statut='success' THEN montant END), 0) as montant_tranches,

                -- Commandes boutique
                SUM(type = 'paiement_commande' AND statut = 'success')  as orders_ok,
                SUM(type = 'paiement_commande' AND statut != 'success') as orders_ko,
                COALESCE(SUM(CASE WHEN type='paiement_commande' AND statut='success' THEN montant END), 0) as montant_orders,

                -- Total
                COALESCE(SUM(CASE WHEN statut='success' THEN montant END), 0) as total_encaisse,

                -- Souscriptions / annulations
                SUM(type = 'souscription') as nb_souscriptions,
                SUM(type = 'annulation')   as nb_annulations
            FROM notifications
            WHERE type IN ('paiement_tranche','paiement_commande','souscription','annulation')
        `);
        return stats;
    }

    /**
     * Stats par utilisateur
     */
    static async getStatsByUser(user_id) {
        const [[stats]] = await db.query(`
            SELECT
                SUM(statut = 'success')                                as nb_reussies,
                SUM(statut IN ('failed','cancelled'))                  as nb_echecs,
                COALESCE(SUM(CASE WHEN statut='success' THEN montant END), 0) as total_paye
            FROM notifications
            WHERE user_id = ?
            AND type IN ('paiement_tranche','paiement_commande')
        `, [user_id]);
        return stats;
    }
}

module.exports = Notification;
