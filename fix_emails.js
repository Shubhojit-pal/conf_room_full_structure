const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const { connectDB } = require('./backend/db');
const User = require('./backend/models/User');

async function fixEmails() {
    try {
        await connectDB();
        const users = await User.find({});
        console.log(`Checking ${users.length} users...`);

        let count = 0;
        for (const user of users) {
            const lowerEmail = user.email.toLowerCase();
            if (user.email !== lowerEmail) {
                console.log(`Updating ${user.email} to ${lowerEmail}`);
                user.email = lowerEmail;
                await user.save();
                count++;
            }
        }

        console.log(`Updated ${count} users.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixEmails();
