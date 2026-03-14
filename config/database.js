'use strict';

/**
 * Configuration du pool de connexions MySQL
 * Utilise mysql2/promise pour les requêtes asynchrones
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:            process.env.DB_HOST     || 'localhost',
    port:            parseInt(process.env.DB_PORT) || 3306,
    user:            process.env.DB_USER     || 'root',
    password:        process.env.DB_PASSWORD || '',
    database:        process.env.DB_NAME     || 'vision4d',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+01:00',
    charset:            'utf8mb4',
    decimalNumbers:     true,
});

// Vérification de la connexion au démarrage
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Connexion MySQL établie — base de données:', process.env.DB_NAME);
        conn.release();
    } catch (err) {
        console.error('❌ Impossible de se connecter à MySQL:', err.message);
        process.exit(1);
    }
})();

module.exports = pool;
