const db = require('./db');

async function checkBookings() {
    try {
        const [rows] = await db.query('SELECT * FROM booking');
        console.log('Total bookings:', rows.length);
        console.log('All bookings:', JSON.stringify(rows, null, 2));

        const [users] = await db.query('SELECT uid, name, email FROM users');
        console.log('All users:', JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkBookings();
