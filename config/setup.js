'use strict';

/**
 * VISION 4D — Script d'initialisation de la base de données
 * Exécuter avec : node config/setup.js
 */

const fs      = require('fs');
const path    = require('path');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
require('dotenv').config();

async function setup() {
    console.log('\n🚀 VISION 4D — Initialisation de la base de données\n');

    // Connexion sans sélectionner de base de données
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
    });

    console.log('✅ Connexion MySQL établie');

    // Lire et exécuter le schéma SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema     = fs.readFileSync(schemaPath, 'utf8');

    // Exécuter chaque requête séparément pour éviter les erreurs multistatement
    const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const stmt of statements) {
        try {
            await conn.query(stmt + ';');
        } catch (err) {
            if (!err.message.includes('already exists') && !err.message.includes('Duplicate entry')) {
                console.warn('⚠️  ', err.message.substring(0, 80));
            }
        }
    }

    console.log('✅ Schéma de base de données appliqué');

    // Sélectionner la base de données
    await conn.query(`USE ${process.env.DB_NAME || 'vision4d'}`);

    // Créer l'admin par défaut
    const adminEmail = process.env.ADMIN_EMAIL    || 'admin@vision4d.cm';
    const adminPass  = process.env.ADMIN_PASSWORD  || 'Admin@2024';
    const adminName  = process.env.ADMIN_NAME      || 'Administrateur';

    const [existing] = await conn.query('SELECT id FROM admins WHERE email = ?', [adminEmail]);
    if (!existing.length) {
        const hash = await bcrypt.hash(adminPass, 12);
        await conn.query(
            'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
            [adminName, adminEmail, hash]
        );
        console.log(`✅ Admin créé — Email: ${adminEmail} | Mot de passe: ${adminPass}`);
    } else {
        console.log(`ℹ️  Admin déjà existant: ${adminEmail}`);
    }

    await conn.end();

    console.log('\n🎉 Initialisation terminée avec succès!\n');
    console.log('─'.repeat(50));
    console.log('  Lancer l\'application: npm run dev');
    console.log('  Site:                 http://localhost:3000');
    console.log('  Panel admin:          http://localhost:3000/admin/connexion');
    console.log(`  Email admin:          ${adminEmail}`);
    console.log(`  Mot de passe:         ${adminPass}`);
    console.log('─'.repeat(50));
    console.log('');
    process.exit(0);
}

setup().catch(err => {
    console.error('❌ Erreur lors de l\'initialisation:', err.message);
    console.error('   Vérifiez vos variables d\'environnement dans .env');
    process.exit(1);
});
