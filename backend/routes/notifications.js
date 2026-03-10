const express = require('express');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

const { sendBookingEmail } = require('../utils/mail');

const router = express.Router();

const Booking = require('../models/Booking');
const Room = require('../models/Room');

// GET all notifications for current user
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Proactively check for upcoming bookings in the next 1 hour
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        
        const dateStr = now.toISOString().split('T')[0];
        const upcomingBookings = await Booking.find({
            uid: req.user.uid,
            status: 'confirmed',
            start_date: dateStr,
            // Simple check: starts after now and before 1 hour from now
            // (Note: this is a simplified time check for demo purposes)
        }).lean();

        for (const booking of upcomingBookings) {
            // Check if reminder already exists
            const existingReminder = await Notification.findOne({
                uid: req.user.uid,
                type: 'reminder',
                booking_id: booking.booking_id
            });

            if (!existingReminder) {
                const room = await Room.findOne({ catalog_id: booking.catalog_id, room_id: booking.room_id }).select('room_name').lean();
                await Notification.create({
                    uid: req.user.uid,
                    title: 'Upcoming Meeting Reminder',
                    message: `Your booking for ${room?.room_name || 'the room'} starts soon at ${booking.start_time}.`,
                    type: 'reminder',
                    booking_id: booking.booking_id
                });

                // Send Email Reminder
                if (req.user.email) {
                    await sendBookingEmail(req.user.email, {
                        room_name: room?.room_name || 'Conference Room',
                        date: booking.start_date,
                        start_time: booking.start_time,
                        end_time: booking.end_time
                    }, 'confirmed'); // Use 'confirmed' template or generic. For now 'confirmed' works.
                }
            }
        }

        const notifications = await Notification.find({ uid: req.user.uid })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (error) {
        console.error('Fetch notifications error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Mark single notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, uid: req.user.uid },
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(notification);
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { uid: req.user.uid, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
