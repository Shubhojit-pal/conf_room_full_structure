const db = require('./db');

async function verifyAll() {
    try {
        console.log('--- Database Schema Check ---');
        const [tables] = await db.query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));

        console.log('\n--- Ticket Details Table Check ---');
        const [tickets] = await db.query('SELECT * FROM ticket_details');
        console.log('Tickets stored:', tickets.length);
        if (tickets.length > 0) console.log('Last ticket:', tickets[tickets.length - 1]);

        console.log('\n--- User Joined Booking Check ---');
        const [bookings] = await db.query(`
            SELECT b.booking_id, u.name, u.email 
            FROM booking b 
            JOIN users u ON b.uid = u.uid 
            LIMIT 1
        `);
        console.log('Sample joined record:', bookings[0]);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

verifyAll();
