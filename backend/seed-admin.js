const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { connectDB } = require('./db');
const Admin = require('./models/Admin');

async function seed() {
    console.log('[SEED] Connecting to MongoDB...');
    await connectDB();

    console.log('[SEED] Connected. Checking for existing admin...');

    const existing = await Admin.findOne({ email: 'akd1@iem.edu.in' });
    if (existing) {
        console.log('[SEED] Admin already exists:');
        console.log('  admin_id:', existing.admin_id);
        console.log('  role:    ', existing.role);
        process.exit(0);
    }

    // Insert the admin using their existing bcrypt hashed password
    const admin = await Admin.create({
        name: 'Demo Admin',
        email: 'akd1@iem.edu.in',
        // Pre-hashed password for "password123"
        password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW',
        phone_no: '0000000000',
        dept: 'IT',
        role: 'super_admin',
        assigned_locations: [],
        isActive: true,
    });

    console.log('[SEED] ✅ Admin created successfully!');
    console.log('  admin_id:', admin.admin_id);
    console.log('  email:   ', admin.email);
    console.log('  role:    ', admin.role);
    console.log('[SEED] You can now log in with:');
    console.log('  Email:    akd1@iem.edu.in');
    console.log('  Password: password123');

    process.exit(0);
}

seed().catch(err => { console.error('[SEED] Error:', err); process.exit(1); });
