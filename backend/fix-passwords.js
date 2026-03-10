const db = require('./db');
const bcrypt = require('bcryptjs');

async function fixPasswords() {
    try {
        const [users] = await db.query('SELECT uid, password FROM users');
        console.log(`Found ${users.length} users. Checking for plain text passwords...`);

        for (const user of users) {
            // Very basic check: bcrypt hashes usually start with $2a$ or $2b$ and are 60 chars long
            if (!user.password.startsWith('$2') || user.password.length < 50) {
                console.log(`Hashing password for user ${user.uid}...`);
                const hashedPassword = await bcrypt.hash(user.password, 10);
                await db.query('UPDATE users SET password = $1 WHERE uid = $2', [hashedPassword, user.uid]);
            }
        }
        console.log('✅ All passwords verified/hashed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing passwords:', error);
        process.exit(1);
    }
}

fixPasswords();
