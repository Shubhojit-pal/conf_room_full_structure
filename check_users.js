const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const { connectDB } = require('./backend/db');
const User = require('./backend/models/User');

async function checkUsers() {
    try {
        await connectDB();
        const users = await User.find({}, 'name email uid');
        console.log('--- Current Users in DB ---');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkUsers();
