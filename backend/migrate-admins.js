/**
 * migrate-admins.js
 *
 * One-time migration script:
 *   Moves existing admin users (userrole_id: 'admin') from the `users`
 *   collection into the new `admins` collection as super_admin.
 *
 * Run ONCE before deploying the new code:
 *   node backend/migrate-admins.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { mongoose } = require('./db');
const User = require('./models/User');
const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');

async function migrate() {
    console.log('[MIGRATE] Connecting to database...');

    try {
        await new Promise((resolve) => {
            if (mongoose.connection.readyState === 1) return resolve();
            mongoose.connection.once('open', resolve);
        });

        console.log('[MIGRATE] Connected. Looking for admin users...');

        const adminUsers = await User.find({ userrole_id: 'admin' }).lean();
        console.log(`[MIGRATE] Found ${adminUsers.length} admin user(s) to migrate.`);

        if (adminUsers.length === 0) {
            console.log('[MIGRATE] Nothing to migrate. Exiting.');
            process.exit(0);
        }

        for (const user of adminUsers) {
            // Check if already migrated
            const existing = await Admin.findOne({ email: user.email });
            if (existing) {
                console.log(`[MIGRATE] Skipping ${user.email} — already in admins collection.`);
                continue;
            }

            await Admin.create({
                name: user.name,
                email: user.email,
                password: user.password, // already hashed
                phone_no: user.phone_no,
                dept: user.dept,
                role: 'super_admin',
                assigned_locations: [],
                isActive: true,
            });

            console.log(`[MIGRATE] Migrated ${user.email} → super_admin in admins collection.`);

            // Remove from users collection
            await User.deleteOne({ _id: user._id });
            console.log(`[MIGRATE] Removed ${user.email} from users collection.`);
        }

        console.log('[MIGRATE] Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('[MIGRATE] Error:', error);
        process.exit(1);
    }
}

migrate();
