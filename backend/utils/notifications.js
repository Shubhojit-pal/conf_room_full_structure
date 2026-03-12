const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Create a notification for a specific user
 * @param {string} uid - User ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'booking', 'system', 'reminder'
 * @param {string} booking_id - Optional booking ID
 */
const createNotification = async (uid, title, message, type = 'booking', booking_id = null) => {
    try {
        await Notification.create({
            uid,
            title,
            message,
            type,
            booking_id
        });
        console.log(`[NOTIFICATION] Created for user ${uid}: ${title}`);
        return true;
    } catch (error) {
        console.error(`[NOTIFICATION] Error creating for user ${uid}:`, error);
        return false;
    }
};

/**
 * Notify all system administrators
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'booking', 'system', 'reminder'
 * @param {string} booking_id - Optional booking ID
 */
const notifyAdmins = async (title, message, type = 'system', booking_id = null) => {
    try {
        const admins = await User.find({ userrole_id: 'admin' }).select('uid').lean();
        
        if (admins.length === 0) {
            console.warn('[NOTIFICATION] No admins found to notify.');
            return false;
        }

        const notificationPromises = admins.map(admin => 
            Notification.create({
                uid: admin.uid,
                title,
                message,
                type,
                booking_id
            })
        );

        await Promise.all(notificationPromises);
        console.log(`[NOTIFICATION] Broadcasted to ${admins.length} admins: ${title}`);
        return true;
    } catch (error) {
        console.error('[NOTIFICATION] Error broadcasting to admins:', error);
        return false;
    }
};

module.exports = {
    createNotification,
    notifyAdmins
};
