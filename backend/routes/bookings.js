/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BOOKING MANAGEMENT ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Handle room reservations with flexible scheduling options
 * 
 * Routes:
 *  - GET    /api/bookings                    (Admin) Get all bookings
 *  - GET    /api/bookings/user/:uid          (Protected) Get user's bookings
 *  - GET    /api/bookings/availability/*     (Public) Check room availability
 *  - POST   /api/bookings                    (Protected) Create booking
 *  - PUT    /api/bookings/:id/status         (Admin) Update booking status
 *  - DELETE /api/bookings/:id                (Protected) Cancel booking
 * 
 * Features:
 *  1. Range-based bookings: Standard date/time range
 *  2. Granular multi-date bookings: Different slots per day
 *  3. Conflict detection: Prevent double-booking
 *  4. Automatic ticket generation: Confirmation tickets
 *  5. Capacity validation: Check room capacity
 * 
 * Booking Flow:
 *  1. User selects room, dates, and time slots
 *  2. System checks for conflicts and capacity
 *  3. Booking created with 'confirmed' status
 *  4. Ticket generated for confirmation
 *  5. Available for display in user's booking list
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Room = require('../models/Room');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { sendBookingEmail } = require('../utils/mail');
const { notifyAdmins } = require('../utils/notifications');
const { validate } = require('../middleware/validate');
const { createBookingSchema, updateBookingStatusSchema } = require('../schemas/booking');

const router = express.Router();

/**
 * HELPER: Generate next sequential booking ID
 * 
 * Logic:
 *  1. Query for latest booking (sorted by booking_id descending)
 *  2. Extract numeric portion (B-15 → "15" → 15)
 *  3. Increment and zero-pad (15 → 16 → "16")
 *  4. Return formatted ID (B-16)
 * 
 * @returns {Promise<string>} Next booking ID (e.g., "B-01", "B-02")
 */
async function getNextBookingId() {
    const last = await Booking.findOne().sort({ booking_id: -1 }).select('booking_id').lean();
    if (!last) return 'B-01';
    const lastNum = parseInt(last.booking_id.split('-')[1]);
    return `B-${String(isNaN(lastNum) ? 1 : lastNum + 1).padStart(2, '0')}`;
}

/**
 * GET /api/bookings (ADMIN ONLY)
 * 
 * Purpose: Retrieve all bookings in the system with enriched data
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Response includes denormalized user and room data for admin dashboard
 * 
 * Success Response (200):
 *  [
 *    {
 *      "booking_id": "B-01",
 *      "catalog_id": "CAT-01",
 *      "room_id": "R-01",
 *      "uid": "U-001",
 *      "start_date": "2024-03-15",
 *      "end_date": "2024-03-15",
 *      "start_time": "09:00:00",
 *      "end_time": "10:00:00",
 *      "purpose": "Team standup",
 *      "attendees": 5,
 *      "status": "confirmed",
 *      "selected_dates": "2024-03-15",
 *      "user_name": "John Doe",
 *      "email": "john@example.com",
 *      "room_name": "Conference Room A",
 *      "ticket_id": "T-01-487"
 *    },
 *    ...
 *  ]
 * 
 * Error Responses:
 *  - 401/403: Missing token or insufficient permissions
 *  - 500: Server error
 */
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        // Fetch all bookings, most recent first
        const bookings = await Booking.find().sort({ start_date: -1, start_time: -1 }).lean();

        // Enrich with user, room, and ticket information
        const enriched = await Promise.all(bookings.map(async (b) => {
            const user = await User.findOne({ uid: b.uid }).select('name email').lean();
            const room = await Room.findOne({ catalog_id: b.catalog_id, room_id: b.room_id }).select('room_name').lean();
            const ticket = await Ticket.findOne({ booking_id: b.booking_id }).select('ticket_id').lean();
            return {
                ...b,
                user_name: user?.name || '',
                email: user?.email || '',
                room_name: room?.room_name || '',
                ticket_id: ticket?.ticket_id || null,
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/bookings/all (PROTECTED)
 * 
 * Purpose: Retrieve all bookings for the calendar (across all users)
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 * 
 * Response: Array of all confirmed/pending bookings with enriched user and room data
 */
router.get('/all', authMiddleware, async (req, res) => {
    try {
        // Fetch all non-cancelled bookings
        const bookings = await Booking.find({ status: { $ne: 'cancelled' } })
            .sort({ start_date: -1, start_time: -1 })
            .lean();

        // Enrich with user and room information
        const enriched = await Promise.all(bookings.map(async (b) => {
            const user = await User.findOne({ uid: b.uid }).select('name email').lean();
            const room = await Room.findOne({ catalog_id: b.catalog_id, room_id: b.room_id })
                .select('room_name location floor_no')
                .lean();
                
            return {
                ...b,
                user_name: user?.name || 'User',
                email: user?.email || '',
                room_name: room?.room_name || 'Room',
                location: room?.location || '',
                floor_no: room?.floor_no || null
            };
        }));

        console.log(`[BOOKING] Found ${enriched.length} total bookings for calendar`);
        res.json(enriched);
    } catch (error) {
        console.error('[BOOKING] Error fetching all bookings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/bookings/user/:uid (PROTECTED)
 * 
 * Purpose: Retrieve all bookings for a specific user
 * 
 * URL Parameters:
 *  - uid: User identifier (e.g., "U-001")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - User can only view their own bookings OR user is admin
 *  - Access control enforced
 * 
 * Success Response (200):
 *  [
 *    {
 *      "booking_id": "B-01",
 *      "catalog_id": "CAT-01",
 *      "room_id": "R-01",
 *      "start_date": "2024-03-15",
 *      "end_date": "2024-03-15",
 *      "purpose": "Team standup",
 *      "attendees": 5,
 *      "status": "confirmed",
 *      "room_name": "Conference Room A",
 *      "location": "Building A, Floor 3",
 *      "floor_no": 3,
 *      "email": "john@example.com",
 *      "ticket_id": "T-01-487"
 *    },
 *    ...
 *  ]
 * 
 * Error Responses:
 *  - 401: No valid token
 *  - 403: Access denied (not own bookings and not admin)
 *  - 500: Server error
 */
router.get('/user/:uid', authMiddleware, async (req, res) => {
    const { uid } = req.params;
    console.log(`[BOOKING] Fetching bookings for user: ${uid}`);
    
    // Verify user is accessing own bookings or is admin
    if (req.user.userrole_id !== 'admin' && req.user.uid !== uid) {
        return res.status(403).json({ error: 'Access denied.' });
    }
    
    try {
        // Fetch all bookings for user, most recent first
        const bookings = await Booking.find({ uid }).sort({ start_date: -1, start_time: -1 }).lean();

        const enriched = await Promise.all(bookings.map(async (b) => {
            const room = await Room.findOne({ catalog_id: b.catalog_id, room_id: b.room_id })
                .select('room_name location floor_no')
                .lean();
            const user = await User.findOne({ uid: b.uid }).select('name email').lean();
            const ticket = await Ticket.findOne({ booking_id: b.booking_id }).select('ticket_id').lean();
            return {
                ...b,
                room_name: room?.room_name || '',
                location: room?.location || '',
                floor_no: room?.floor_no || null,
                user_name: user?.name || '',
                email: user?.email || '',
                ticket_id: ticket?.ticket_id || null,
            };
        }));

        console.log(`[BOOKING] Found ${enriched.length} bookings for user ${uid}`);
        res.json(enriched);
    } catch (error) {
        console.error('[BOOKING] Error fetching user bookings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/bookings/availability/:catalog_id/:room_id (PUBLIC)
 * 
 * Purpose: Check room availability for a specific date
 * Returns all bookings (occupied time slots) for that room/date
 * 
 * URL Parameters:
 *  - catalog_id: Catalog identifier (e.g., "CAT-01")
 *  - room_id: Room identifier (e.g., "R-01")
 * 
 * Query Parameters:
 *  - date: Date to check (required, format: YYYY-MM-DD)
 *          Example: /api/bookings/availability/CAT-01/R-01?date=2024-03-15
 * 
 * Response: Array of booked time slots for the specified date
 *  [
 *    {
 *      "start_time": "09:00:00",
 *      "end_time": "10:00:00",
 *      "status": "confirmed",
 *      "purpose": "Team standup",
 *      "user_name": "John Doe",
 *      "email": "john@example.com",
 *      "phone_no": "+1234567890"
 *    },
 *    ...
 *  ]
 * 
 * Error Responses:
 *  - 400: Missing date query parameter
 *  - 500: Server error
 * 
 * Usage:
 *  Frontend calls this endpoint when user selects a date
 *  to show which time slots are available and which are booked
 */
router.get('/availability/:catalog_id/:room_id', async (req, res) => {
    const { catalog_id, room_id } = req.params;
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ 
            error: 'date query parameter is required (YYYY-MM-DD).' 
        });
    }

    try {
        // Find all non-cancelled bookings for this room that overlap the date
        const bookings = await Booking.find({
            catalog_id,
            room_id,
            start_date: { $lte: date }, // Booking starts on or before this date
            end_date: { $gte: date },    // Booking ends on or after this date
            status: { $ne: 'cancelled' },
        }).sort({ start_time: 1 }).lean();

        const result = [];
        for (const b of bookings) {
            // Filter by selected_dates if specified (granular booking)
            if (b.selected_dates) {
                const dates = b.selected_dates.split(',');
                if (!dates.includes(date)) continue; // Skip if this date not in booking
            }
            
            // Fetch user details for display
            const user = await User.findOne({ uid: b.uid })
                .select('name email phone_no')
                .lean();
            
            result.push({
                start_time: b.start_time,
                end_time: b.end_time,
                status: b.status,
                purpose: b.purpose,
                selected_slots: b.selected_slots,
                selected_dates: b.selected_dates,
                user_name: user?.name || '',
                email: user?.email || '',
                phone_no: user?.phone_no || '',
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/bookings (PROTECTED)
 * 
 * Purpose: Create a new room booking
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - User can only book for themselves (or admin can book for others)
 * 
 * Booking Strategies:
 * 
 * STRATEGY 1: Granular Multi-Date Booking (Advanced)
 * ─────────────────────────────────────────────────
 *  POST /api/bookings
 *  {
 *    "uid": "U-001",
 *    "catalog_id": "CAT-01",
 *    "room_id": "R-01",
 *    "purpose": "Product planning - multi-day sprint",
 *    "attendees": 8,
 *    "per_date_choices": [
 *      { "date": "2024-03-15", "slots": ["09:00-10:00", "10:00-11:00"] },
 *      { "date": "2024-03-16", "slots": ["14:00-15:00"] },
 *      { "date": "2024-03-17", "slots": ["09:00-10:00", "10:00-11:00", "11:00-12:00"] }
 *    ]
 *  }
 * 
 *  Process:
 *  1. Group dates by matching slot ranges
 *  2. Validate no conflicts for each date
 *  3. Create single booking record with:
 *     - start_date: First date, end_date: Last date
 *     - selected_dates: All dates (comma-separated)
 *     - selected_slots: All unique slots (comma-separated)
 * 
 * STRATEGY 2: Range-Based Booking (Simple)
 * ─────────────────────────────────────────
 *  POST /api/bookings
 *  {
 *    "uid": "U-001",
 *    "catalog_id": "CAT-01",
 *    "room_id": "R-01",
 *    "purpose": "Weekly team meeting",
 *    "attendees": 10,
 *    "start_date": "2024-03-15",
 *    "end_date": "2024-03-17",
 *    "start_time": "09:00:00",
 *    "end_time": "10:00:00",
 *    "selected_dates": "2024-03-15,2024-03-16,2024-03-17"
 *  }
 * 
 *  Process:
 *  1. Generate all dates from start_date to end_date
 *  2. Check for conflicts on each date+time
 *  3. Create single booking record
 * 
 * Success Response (201):
 *  - Granular: { "message": "Granular bookings created.", "bookings": [...] }
 *  - Range: { "message": "Booking created successfully.", "booking_id": "B-01", "ticket_id": "T-01-487" }
 * 
 * Error Responses:
 *  - 400: Missing required fields or attendees exceed capacity
 *  - 403: Access denied
 *  - 404: Room not found
 *  - 409: Time slot conflict
 *  - 500: Server error
 */
router.post('/', authMiddleware, validate(createBookingSchema), async (req, res) => {
    const {
        uid, catalog_id, room_id, purpose, attendees,
        start_date, end_date, start_time, end_time, selected_dates,
        per_date_choices
    } = req.body;

    // Verify user is booking for themselves or is admin
    if (req.user.userrole_id !== 'admin' && req.user.uid !== uid) {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        // Verify room exists
        const roomObj = await Room.findOne({ catalog_id, room_id }).lean();
        if (!roomObj) return res.status(404).json({ error: 'Room not found.' });

        // Validate attendee count
        const attendeeCount = parseInt(attendees) || 1;
        if (attendeeCount > roomObj.capacity) {
            return res.status(400).json({ 
                error: `Attendees exceed room capacity (${roomObj.capacity}).` 
            });
        }

        // ┌─────────────────────────────────────────────────────┐
        // │ STRATEGY 1: GRANULAR MULTI-DATE BOOKINGS           │
        // │ User selects different slots for different dates   │
        // └─────────────────────────────────────────────────────┘
        if (per_date_choices && Array.isArray(per_date_choices) && per_date_choices.length > 0) {
            console.log('[BOOKING] Processing granular multi-date bookings:', per_date_choices.length);

            // Group dates by identical slot configurations
            const groupedChoices = new Map(); // Map<dbSlots, { dates: string[], sTime, eTime }>

            for (const choice of per_date_choices) {
                const { date, slots } = choice;
                if (!date || !slots || slots.length === 0) continue;

                const sortedSlots = [...slots].sort();
                const sTime = sortedSlots[0].split('-')[0].includes(':00') 
                    ? sortedSlots[0].split('-')[0] 
                    : sortedSlots[0].split('-')[0] + ':00:00';
                const eTime = sortedSlots[sortedSlots.length - 1].split('-')[1].includes(':00') 
                    ? sortedSlots[sortedSlots.length - 1].split('-')[1] 
                    : sortedSlots[sortedSlots.length - 1].split('-')[1] + ':00:00';

                // Normalize slots with :00:00 suffix for DB consistency
                const dbSlots = sortedSlots.map(s => {
                    return s.split('-').map(t => t.includes(':00') ? t : t + ':00:00').join('-');
                }).join(',');

                if (groupedChoices.has(dbSlots)) {
                    groupedChoices.get(dbSlots).dates.push(date);
                } else {
                    groupedChoices.set(dbSlots, { dates: [date], sTime, eTime });
                }
            }

            const results = [];

            // Validate and insert each group
            for (const [dbSlots, groupInfo] of groupedChoices.entries()) {
                const { dates, sTime, eTime } = groupInfo;
                const sortedGroupDates = [...dates].sort();
                const sortedSlots = dbSlots.split(',').map(s => s.replace(/:00:00/g, ''));

                // Check for conflicts on each date
                for (const date of sortedGroupDates) {
                    const existing = await Booking.find({
                        catalog_id, room_id,
                        status: { $ne: 'cancelled' },
                        selected_dates: { $regex: new RegExp(date) }
                    }).lean();

                    const hasConflict = existing.some(ext => {
                        const extSlots = ext.selected_slots ? ext.selected_slots.split(',') : [];
                        return extSlots.some(es => sortedSlots.some(ss => {
                            const esRange = es.split('-').map(t => parseInt(t.split(':')[0]));
                            const ssRange = ss.split('-').map(t => parseInt(t.split(':')[0]));
                            return (ssRange[0] < esRange[1] && ssRange[1] > esRange[0]);
                        }));
                    });

                    if (hasConflict) {
                        return res.status(409).json({ 
                            error: `Conflict on ${date} for one or more slots.` 
                        });
                    }
                }

                // Create booking for this group
                const booking_id = await getNextBookingId();
                const booking = await Booking.create({
                    booking_id,
                    catalog_id,
                    room_id,
                    uid,
                    start_date: sortedGroupDates[0],
                    end_date: sortedGroupDates[sortedGroupDates.length - 1],
                    start_time: sTime,
                    end_time: eTime,
                    purpose,
                    attendees: attendeeCount,
                    selected_slots: dbSlots,
                    selected_dates: sortedGroupDates.join(','),
                    status: 'confirmed'
                });

                // Generate ticket for confirmation
                const ticket_id = `T-${booking_id.split('-')[1]}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
                await Ticket.create({ ticket_id, booking_id, uid }).catch(e => console.warn("Failed to create ticket. Ignoring.", e));

                // Create Notification
                await Notification.create({
                    uid,
                    title: 'Booking Confirmed',
                    message: `Your granular booking for ${roomObj.room_name} has been confirmed.`,
                    type: 'booking',
                    booking_id
                }).catch(e => console.error('Failed to create notification:', e));

                // Notify Admins of Granular Booking
                const bookingUser = await User.findOne({ uid }).select('name').lean();
                await notifyAdmins(
                    'New Granular Booking Created',
                    `A new multi-date booking has been created by ${bookingUser?.name || 'a user'} for ${roomObj.room_name}.`,
                    'booking',
                    booking_id
                );

                results.push({
                    ...booking.toObject(),
                    ticket_id
                });
            }

            return res.status(201).json({ 
                message: 'Granular bookings created.', 
                bookings: results,
                booking_id: results.length > 0 ? results[0].booking_id : undefined,
                ticket_id: results.length > 0 ? results[0].ticket_id : undefined
            });
        }

        // ┌─────────────────────────────────────────────────────┐
        // │ STRATEGY 2: RANGE-BASED BOOKING (Fallback)         │
        // │ Standard date range with fixed time slot           │
        // └─────────────────────────────────────────────────────┘
        if (!start_date || !end_date || !start_time || !end_time) {
            return res.status(400).json({ 
                error: 'Missing date/time fields for range booking.' 
            });
        }

        // Generate list of active dates
        const activeDates = selected_dates
            ? selected_dates.split(',').map(d => d.trim()).filter(Boolean)
            : (() => {
                const days = [];
                let curr = new Date(start_date);
                const stop = new Date(end_date);
                while (curr <= stop) {
                    days.push(curr.toISOString().slice(0, 10));
                    curr.setDate(curr.getDate() + 1);
                }
                return days;
            })();

        // Check for conflicts on each date
        for (const date of activeDates) {
            const conflicts = await Booking.find({
                catalog_id,
                room_id,
                status: { $ne: 'cancelled' },
                selected_dates: { $regex: new RegExp(date) },
                $or: [
                    { start_time: { $lt: end_time }, end_time: { $gt: start_time } }
                ]
            });
            if (conflicts.length > 0) {
                return res.status(409).json({ 
                    error: `Room is already booked on ${date} during this time.` 
                });
            }
        }

        // Create booking
        const booking_id = await getNextBookingId();

        let finalSlots = req.body.selected_slots || null;
        if (!finalSlots && start_time && end_time) {
            // Generate slots for range booking (e.g. 09:00:00 to 12:00:00 -> 09:00:00-10:00:00,10:00:00-11:00:00,11:00:00-12:00:00)
            const sH = parseInt(start_time.split(':')[0]);
            const eH = parseInt(end_time.split(':')[0]);
            const slotsArr = [];
            for (let h = sH; h < eH; h++) {
                const s = `${String(h).padStart(2, '0')}:00:00`;
                const e = `${String(h + 1).padStart(2, '0')}:00:00`;
                slotsArr.push(`${s}-${e}`);
            }
            if (slotsArr.length > 0) finalSlots = slotsArr.join(',');
        }

        const booking = await Booking.create({
            booking_id,
            catalog_id,
            room_id,
            uid,
            start_date,
            end_date,
            start_time,
            end_time,
            purpose,
            attendees: attendeeCount,
            selected_slots: finalSlots,
            selected_dates: activeDates.join(','),
        });

        // Generate ticket
        const ticket_id = `T-${booking_id.split('-')[1]}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        await Ticket.create({ ticket_id, booking_id, uid });

        // Create Notification
        await Notification.create({
            uid,
            title: 'Booking Confirmed',
            message: `Your booking for ${roomObj.room_name} on ${activeDates[0]} has been confirmed.`,
            type: 'booking',
            booking_id
        }).catch(e => console.error('Failed to create notification:', e));

            // Notify Admins of Range Booking
            const bookingUser = await User.findOne({ uid }).select('name').lean();
            await notifyAdmins(
                'New Booking Created',
                `A new booking for ${roomObj.room_name} on ${activeDates[0]} has been created by ${bookingUser?.name || 'a user'}.`,
                'booking',
                booking_id
            );

        // Send Email Notification
        if (bookingUser && bookingUser.email) {
            await sendBookingEmail(bookingUser.email, {
                room_name: roomObj.room_name,
                date: activeDates[0],
                start_time,
                end_time
            }, 'confirmed');
        }

        console.log('[BOOKING] Successfully inserted booking and ticket:', { 
            booking_id, 
            ticket_id, 
            dates: activeDates.join(',') 
        });
        
        res.status(201).json({ 
            message: 'Booking created successfully.', 
            booking_id, 
            ticket_id 
        });
    } catch (error) {
        console.error('[BOOKING] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/bookings/:id/status (ADMIN ONLY)
 * 
 * Purpose: Update booking approval status
 * 
 * URL Parameters:
 *  - id: Booking ID (e.g., "B-01")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Request Body:
 *  { "status": "confirmed" | "pending" | "rejected" | "cancelled" }
 * 
 * Success Response (200):
 *  {
 *    "message": "Booking B-01 updated to \"confirmed\"."
 *  }
 * 
 * Error Responses:
 *  - 400: Invalid status value
 *  - 404: Booking not found
 *  - 401/403: Missing token or insufficient permissions
 *  - 500: Server error
 */
router.put('/:id/status', authMiddleware, adminOnly, validate(updateBookingStatusSchema), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await Booking.findOneAndUpdate(
            { booking_id: id }, 
            { status }, 
            { new: true }
        );
        if (!result) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        // Create notification for status change
        const room = await Room.findOne({ catalog_id: result.catalog_id, room_id: result.room_id }).select('room_name').lean();
        await Notification.create({
            uid: result.uid,
            title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your booking for ${room?.room_name || 'the room'} has been ${status}.`,
            type: 'booking',
            booking_id: id
        }).catch(e => console.error('Failed to create notification:', e));

        // Notify Admins (other than the one who made the change) OR just log it. 
        // Typically, we notify IF it's a critical change or if a user cancelled.
        if (status === 'cancelled') {
            const bookingUser = await User.findOne({ uid: result.uid }).select('name').lean();
            await notifyAdmins(
                'Booking Cancelled (by Admin)',
                `Booking ${id} for ${room?.room_name || 'a room'} has been cancelled by an administrator.`,
                'booking',
                id
            );
        }

        // Send Email Notification
        if (bookingUser && bookingUser.email) {
            const fullUser = await User.findOne({ uid: result.uid }).select('email').lean();
            if (fullUser && fullUser.email) {
                await sendBookingEmail(fullUser.email, {
                    room_name: room?.room_name || 'Conference Room',
                    date: result.start_date,
                    start_time: result.start_time,
                    end_time: result.end_time
                }, status);
            }
        }

        res.json({ message: `Booking ${id} updated to "${status}".` });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/bookings/:id (PROTECTED)
 * 
 * Purpose: Cancel a booking
 * 
 * URL Parameters:
 *  - id: Booking ID (e.g., "B-01")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - User can only cancel their own bookings OR is admin
 * 
 * Note: This marks booking as 'cancelled' (soft delete),
 * not hard delete. Cancellation record should be created separately.
 * 
 * Success Response (200):
 *  {
 *    "message": "Booking cancelled successfully."
 *  }
 * 
 * Error Responses:
 *  - 401: No valid token
 *  - 403: Access denied (not own booking and not admin)
 *  - 404: Booking not found
 *  - 500: Server error
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const booking = await Booking.findOne({ booking_id: id }).lean();
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        // Check access: user owns booking or is admin
        if (req.user.userrole_id !== 'admin' && req.user.uid !== booking.uid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Mark booking as cancelled
        await Booking.updateOne({ booking_id: id }, { status: 'cancelled' });

        // Send Email Notification
        const targetUser = await User.findOne({ uid: booking.uid });
        const roomInfo = await Room.findOne({ catalog_id: booking.catalog_id, room_id: booking.room_id });
        if (targetUser && targetUser.email) {
            await sendBookingEmail(targetUser.email, {
                room_name: roomInfo?.room_name || 'Conference Room',
                date: booking.start_date,
                start_time: booking.start_time,
                end_time: booking.end_time
            }, 'cancelled');
        }

        // Notify Admins of User Cancellation
        const bookingUser = await User.findOne({ uid: booking.uid }).select('name').lean();
        await notifyAdmins(
            'Booking Cancelled by User',
            `User ${bookingUser?.name || 'Unknown'} cancelled their booking (${id}) for ${roomInfo?.room_name || 'a room'}.`,
            'booking',
            id
        );

        res.json({ message: 'Booking cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
