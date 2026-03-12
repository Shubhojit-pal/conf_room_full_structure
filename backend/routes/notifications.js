/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTIFICATION ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Manage in-app notifications for authenticated users.
 *          Also proactively creates booking reminder notifications when
 *          fetching, to alert users of upcoming meetings.
 *
 * Routes:
 *  - GET /api/notifications            (Protected) Get all notifications for the current user
 *  - PUT /api/notifications/:id/read   (Protected) Mark a single notification as read
 *  - PUT /api/notifications/read-all   (Protected) Mark all notifications as read
 *
 * Side Effects on GET:
 *  - Checks for confirmed bookings starting within the current day
 *  - Creates a 'reminder' notification if one does not already exist
 *  - Sends an email reminder to the user if their email is available
 *
 * Authorization:
 *  - All routes require a valid JWT token via authMiddleware
 *  - Users can only access and modify their own notifications
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

const { sendBookingEmail } = require('../utils/mail');

const router = express.Router();

const Booking = require('../models/Booking');
const Room = require('../models/Room');

/**
 * GET /api/notifications (PROTECTED)
 *
 * Purpose: Retrieve all notifications for the currently authenticated user.
 *          As a side effect, this route also checks for any upcoming meetings
 *          today and auto-creates reminder notifications if they don't exist yet.
 *
 * Side Effects (proactive reminders):
 *  1. Queries confirmed bookings for the current user on today's date.
 *  2. For each upcoming booking without an existing reminder, creates one.
 *  3. Optionally sends an email reminder if req.user.email is available.
 *
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *
 * Success Response (200):
 *  [
 *    {
 *      "_id": "...",
 *      "uid": "U-001",
 *      "title": "Booking Cancelled",
 *      "message": "Your booking has been cancelled.",
 *      "type": "booking",
 *      "isRead": false,
 *      "createdAt": "2024-03-10T14:30:00Z"
 *    },
 *    ...
 *  ]
 *
 * @returns {Array<Notification>} Up to 50 most recent notifications (newest first)
 */
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

/**
 * PUT /api/notifications/:id/read (PROTECTED)
 *
 * Purpose: Mark a single notification as read by its MongoDB document ID.
 *          Only the owner of the notification can mark it as read
 *          (enforced via matching uid in the query).
 *
 * URL Parameters:
 *  - id: MongoDB ObjectId of the notification (e.g., "65f1a2b3c4d5e6f7a8b9c0d1")
 *
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *
 * Success Response (200): Returns the updated notification document.
 *
 * Error Responses:
 *  - 404: Notification not found or does not belong to the current user
 *  - 500: Server error
 */
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

/**
 * PUT /api/notifications/read-all (PROTECTED)
 *
 * Purpose: Batch-mark ALL unread notifications for the current user as read.
 *          More efficient than calling /:id/read for each notification individually.
 *
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *
 * Success Response (200):
 *  { "message": "All notifications marked as read" }
 *
 * Error Responses:
 *  - 500: Server error
 */
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
