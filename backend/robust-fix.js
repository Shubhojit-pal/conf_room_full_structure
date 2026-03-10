const db = require('./db');
const bcrypt = require('bcryptjs');

async function fix() {
    try {
        const email = 'AKD1@iem.edu.in';
        const role = 'admin';
        const pass = 'password123';
        const hashed = await bcrypt.hash(pass, 10);

        console.log('START_FIX');
        const uid = 'U-999';
        const name = 'Demo Admin';
        const dept = 'IT';
        const phone = '0000000000';

        const [rows, res] = await db.query(
            'INSERT INTO users (uid, userrole_id, name, email, password, dept, phone_no) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING',
            [uid, role, name, email, hashed, dept, phone]
        );
        console.log('AFFECTED:' + res.rowCount);

        // If it already existed, update it
        if (res.rowCount === 0) {
            await db.query('UPDATE users SET userrole_id = $1, password = $2 WHERE email = $3', [role, hashed, email]);
            console.log('UPDATED existing user');
        }

        const [finalRows] = await db.query('SELECT uid, email, userrole_id FROM users WHERE email = $1', [email]);
        console.log('RESULT:' + JSON.stringify(finalRows));
        console.log('END_FIX');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:' + err.message);
        process.exit(1);
    }
}
fix();
