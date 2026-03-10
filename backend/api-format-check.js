const db = require('./db');

async function checkApiFormat() {
    try {
        const uid = 'USER-001';
        const [rows] = await db.query(`
            SELECT b.*, c.room_name, c.location, c.floor_no
            FROM booking b
            JOIN conference_catalog c ON b.catalog_id = c.catalog_id AND b.room_id = c.room_id
            WHERE b.uid = $1
        `, [uid]);
        console.log('API format response for USER-001:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkApiFormat();
