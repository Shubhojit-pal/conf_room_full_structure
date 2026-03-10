const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // Uses quote-escaped password from .env
    multipleStatements: true
});

const schemaFilePath = path.join(__dirname, '..', 'database', 'conference_system.sql');
const seedFilePath = path.join(__dirname, '..', 'database', 'seed.sql');

const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');
const seedSql = fs.readFileSync(seedFilePath, 'utf8');

connection.connect(async (err) => {
    if (err) {
        console.error('❌ DB connection failed:', err.stack);
        return;
    }

    console.log('✅ Connected to MySQL successfully.');

    try {
        console.log('Loading schema...');
        await connection.promise().query(schemaSql);
        console.log('✅ Schema loaded successfully!');

        console.log('Loading seed data...');
        // We use INSERT IGNORE in case it has been seeded previously or we just ignore duplicate errors
        // However, since multipleStatements is true, queries run as a batch.
        await connection.promise().query(seedSql);
        console.log('✅ Seed data loaded successfully!');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('⚠️ Seed data already exists (Duplicate Entry ignored).');
        } else {
            console.error('❌ Failed to run SQL script:', error.message);
        }
    } finally {
        connection.end();
    }
});
