/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CANCELLATION MANAGEMENT ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Handle booking cancellations (full and partial) with audit trails
 * 
 * Routes:
 *  - GET  /api/cancellations              (Admin) Get all cancellations
 *  - POST /api/cancellations              (Protected) Create cancellation
 * 
 * Features:
 *  - Full cancellation: Cancel entire booking
 *  - Partial cancellation: Remove specific dates/slots from multi-day bookings
 *  - Auto-split bookings: Creates multiple booking records for partial cancels
 *  - Audit trail: Records who cancelled and when
 * 
 * Cancellation Logic:
 *  1. Full Cancellation: Mark booking status as 'cancelled'
 *  2. Partial Cancellation:
 *     a. Parse current booking dates/slots
 *     b. Remove specified dates/slots from the dataset
 *     c. Group remaining dates by similar slot ranges
 *     d. Update original record with first group
 *     e. Create new booking records for additional groups (booking splits)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const Booking = require('../models/Booking');
const Cancellation = require('../models/Cancellation');
const User = require('../models/User');
const Room = require('../models/Room');
const Notification = require('../models/Notification');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { notifyAdmins } = require('../utils/notifications');

const router = express.Router();

/**
 * HELPER: Generate next sequential cancellation ID
 * 
 * Logic:
 *  1. Query for latest cancellation (sorted by cancel_id descending)
 *  2. Extract numeric portion (C-05 → "05" → 5)
 *  3. Increment and zero-pad (5 → 6 → "06")
 *  4. Return formatted ID (C-06)
 * 
 * @returns {Promise<string>} Next cancellation ID (e.g., "C-01", "C-02")
 */
async function getNextCancelId() {
    const last = await Cancellation.findOne().sort({ cancel_id: -1 }).select('cancel_id').lean();
    if (!last) return 'C-01';
    const lastNum = parseInt(last.cancel_id.split('-')[1]);
    return `C-${String(isNaN(lastNum) ? 1 : lastNum + 1).padStart(2, '0')}`;
}

/**
 * GET /api/cancellations (ADMIN ONLY)
 * 
 * Purpose: Retrieve all cancellation records in the system
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Process:
 *  1. Fetch all cancellation records
 *  2. Sort by most recent first (cancel_date descending)
 *  3. Enrich with related booking and user information
 *  4. Return aggregated data with denormalized fields
 * 
 * Success Response (200):
 *  [
 *    {
 *      "_id": "...",
 *      "cancel_id": "C-01",
 *      "booking_id": "B-02",
 *      "cancel_reason": "Client cancelled meeting",
 *      "cancel_date": "2024-03-10",
 *      "uid": "U-001",
 *      "cancelled_by_name": "Admin User",
 *      "user_name": "John Doe",
 *      "room_name": "Conference Room A",
 *      "purpose": "Team standup",
 *      "start_date": "2024-03-11",
 *      "start_time": "09:00:00",
 *      "catalog_id": "CAT-01",
 *      "room_id": "R-01",
 *      "createdAt": "2024-03-10T14:30:00Z"
 *    },
 *    ...
 *  ]
 * 
 * Error Responses:
 *  - 401: No valid token
 *  - 403: Not admin
 *  - 500: Server error
 */
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        // Fetch all cancellations, sorted by most recent first
        const cancellations = await Cancellation.find().sort({ cancel_date: -1 }).lean();

        // Enrich each cancellation with related data
        const enriched = await Promise.all(cancellations.map(async (cn) => {
            // Fetch related booking
            const booking = await Booking.findOne({ booking_id: cn.booking_id })
                .select('uid catalog_id room_id purpose start_date start_time')
                .lean();
            
            // Fetch who performed the cancellation
            const user = await User.findOne({ uid: cn.cancelled_by_uid })
                .select('name')
                .lean();
            
            // Fetch room details
            let roomName = '';
            if (booking) {
                const room = await Room.findOne({ catalog_id: booking.catalog_id, room_id: booking.room_id })
                    .select('room_name')
                    .lean();
                roomName = room?.room_name || '';
            }

            return {
                ...cn,
                uid: booking?.uid || '',
                catalog_id: booking?.catalog_id || '',
                room_id: booking?.room_id || '',
                purpose: booking?.purpose || '',
                start_date: booking?.start_date || '',
                start_time: booking?.start_time || '',
                cancelled_by_name: user?.name || '',
                room_name: roomName,
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching cancellations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * HELPER: Generate next sequential booking ID
 * (Copied from bookings.js for split logic)
 * 
 * Used when partial cancellation creates new booking records
 * @returns {Promise<string>} Next booking ID (e.g., "B-01", "B-02")
 */
async function getNextBookingId() {
    const last = await Booking.findOne().sort({ booking_id: -1 }).select('booking_id').lean();
    if (!last) return 'B-01';
    const lastNum = parseInt(last.booking_id.split('-')[1]);
    return `B-${String(isNaN(lastNum) ? 1 : lastNum + 1).padStart(2, '0')}`;
}

/**
 * POST /api/cancellations (PROTECTED)
 * 
 * Purpose: Record booking cancellation (full or partial)
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - User can cancel their own bookings or admin can cancel any
 * 
 * Required Fields (JSON Body):
 *  - booking_id: ID of booking to cancel (e.g., "B-01")
 *  - cancel_date: Date when cancellation occurs (YYYY-MM-DD)
 *  - cancel_reason: Explanation for cancellation (required)
 *  - cancelled_by_uid: User initiating cancellation
 * 
 * Optional Fields (for partial cancellations):
 *  - partial: Boolean flag indicating partial cancellation
 *  - partial_removals: Array of { date, slots }
 *    Example: [
 *      { date: "2024-03-15", slots: ["10:00:00-11:00:00", "14:00:00-15:00:00"] },
 *      { date: "2024-03-16", slots: ["09:00:00-10:00:00"] }
 *    ]
 * 
 * Cancellation Types:
 * 
 * 1. FULL CANCELLATION (simple):
 *    POST /api/cancellations
 *    {
 *      "booking_id": "B-02",
 *      "cancel_date": "2024-03-10",
 *      "cancel_reason": "Meeting postponed",
 *      "cancelled_by_uid": "U-001"
 *    }
 *    - Marks entire booking with status = 'cancelled'
 * 
 * 2. PARTIAL CANCELLATION (advanced):
 *    POST /api/cancellations
 *    {
 *      "booking_id": "B-02",
 *      "cancel_date": "2024-03-10",
 *      "cancel_reason": "Reduced scope - only need 1 day",
 *      "cancelled_by_uid": "U-001",
 *      "partial": true,
 *      "partial_removals": [
 *        { "date": "2024-03-16", "slots": ["10:00-11:00"] },
 *        { "date": "2024-03-17", "slots": ["all"] }
 *      ]
 *    }
 * 
 *    Partial Logic:
 *    a. Parse current booking slots and dates
 *    b. Remove specified dates/time slots from the set
 *    c. Group remaining dates by matching slot ranges
 *    d. Update original booking with first group
 *    e. Create new booking records for remaining groups (splits)
 * 
 * Success Response (201):
 *  {
 *    "message": "Cancellation recorded.",
 *    "cancel_id": "C-01"
 *  }
 * 
 * Error Responses:
 *  - 400: Missing required fields
 *  - 401: No valid token
 *  - 403: Access denied (not own booking and not admin)
 *  - 404: Booking not found
 *  - 500: Server error
 */
router.post('/', authMiddleware, async (req, res) => {
    const {
        booking_id, cancel_reason, cancel_date,
        cancelled_by_uid, partial, partial_removals
    } = req.body;

    // Validate required fields
    if (!booking_id || !cancel_date || !cancelled_by_uid) {
        return res.status(400).json({ 
            error: 'booking_id, cancel_date, and cancelled_by_uid are required.' 
        });
    }

    if (!cancel_reason || cancel_reason.trim() === '') {
        return res.status(400).json({ error: 'Cancellation reason is required.' });
    }

    // Verify user permission: user cancelling own booking or admin
    if (req.user.userrole_id !== 'admin' && req.user.uid !== cancelled_by_uid) {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        // Fetch booking to verify it exists and check ownership
        const booking = await Booking.findOne({ booking_id }).lean();
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        // Verify user is owner or admin
        if (req.user.userrole_id !== 'admin' && booking.uid !== req.user.uid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Generate new cancellation ID
        const cancel_id = await getNextCancelId();

        // Create cancellation audit record
        await Cancellation.create({
            cancel_id, 
            booking_id, 
            cancel_reason, 
            cancel_date,
            cancelled_by_uid,
        });

        // Handle PARTIAL CANCELLATION: Remove specific dates/slots
        if (partial && partial_removals && Array.isArray(partial_removals)) {
            console.log('[CANCEL] Robust Partial cancellation for booking', booking_id);

            // ┌─────────────────────────────────────────────────────┐
            // │ STEP 1: Parse current booking into date-slot map    │
            // └─────────────────────────────────────────────────────┘
            let currentSlots = booking.selected_slots 
                ? booking.selected_slots.split(',') 
                : [];
            
            let currentDates = booking.selected_dates 
                ? booking.selected_dates.split(',') 
                : [booking.start_date.slice(0, 10)];

            // If no slots defined, generate from time range
            if (currentSlots.length === 0) {
                let h = parseInt(booking.start_time.split(':')[0]);
                const endH = parseInt(booking.end_time.split(':')[0]);
                while (h < endH) {
                    currentSlots.push(
                        `${h.toString().padStart(2, '0')}:00:00-${(h + 1).toString().padStart(2, '0')}:00:00`
                    );
                    h++;
                }
            }

            // Create Map: Date → Set of slot Strings
            const dateMap = new Map();
            currentDates.forEach(d => dateMap.set(d, new Set(currentSlots)));

            // ┌─────────────────────────────────────────────────────┐
            // │ STEP 2: Remove specified dates/slots                │
            // └─────────────────────────────────────────────────────┘
            partial_removals.forEach(rem => {
                const daySlots = dateMap.get(rem.date);
                if (daySlots && rem.slots) {
                    rem.slots.forEach(s => {
                        // Normalize slot format (HH:MM → HH:MM:SS)
                        const normalizedSlot = s.includes(':00:00') 
                            ? s 
                            : s.split('-').map(t => t.length === 5 ? t + ':00' : t).join('-');
                        daySlots.delete(normalizedSlot);
                        
                        // Remove date if all slots are gone
                        if (daySlots.size === 0) dateMap.delete(rem.date);
                    });
                }
            });

            // If nothing remains, cancel entire booking
            if (dateMap.size === 0) {
                await Booking.updateOne({ booking_id }, { status: 'cancelled' });
            } else {
                // ┌─────────────────────────────────────────────────┐
                // │ STEP 3: Re-group by unique slot sets            │
                // │ Minimizes number of split bookings               │
                // └─────────────────────────────────────────────────┘
                const groups = []; // Array of { slots: string, dates: string[] }
                
                for (const [date, slotSet] of dateMap.entries()) {
                    const sortedSlots = Array.from(slotSet).sort();
                    const slotsKey = sortedSlots.join(',');
                    
                    // Find or create group with same slots
                    let group = groups.find(g => g.slots === slotsKey);
                    if (!group) {
                        group = { slots: slotsKey, dates: [] };
                        groups.push(group);
                    }
                    group.dates.push(date);
                }

                // ┌─────────────────────────────────────────────────┐
                // │ STEP 4: Update or create booking records        │
                // │ - First group updates original                  │
                // │ - Additional groups create new split bookings   │
                // └─────────────────────────────────────────────────┘
                for (let i = 0; i < groups.length; i++) {
                    const g = groups[i];
                    g.dates.sort(); // Chronological order
                    
                    const sDate = g.dates[0]; // First date
                    const eDate = g.dates[g.dates.length - 1]; // Last date
                    const sTime = g.slots.split(',')[0].split('-')[0]; // First slot start
                    const eTime = g.slots.split(',').slice(-1)[0].split('-')[1]; // Last slot end

                    if (i === 0) {
                        // UPDATE original booking record
                        await Booking.updateOne({ booking_id }, {
                            start_date: sDate, 
                            end_date: eDate,
                            start_time: sTime, 
                            end_time: eTime,
                            selected_slots: g.slots,
                            selected_dates: g.dates.join(','),
                        });
                    } else {
                        // CREATE new booking record (split)
                        const newId = await getNextBookingId();
                        const newBookingData = {
                            ...booking,
                            _id: undefined, // Let MongoDB generate
                            booking_id: newId,
                            start_date: sDate, 
                            end_date: eDate,
                            start_time: sTime, 
                            end_time: eTime,
                            selected_slots: g.slots,
                            selected_dates: g.dates.join(','),
                            createdAt: undefined, 
                            updatedAt: undefined
                        };
                        await Booking.create(newBookingData);
                    }
                }
            }
        } else if (partial) {
            // Legacy partial logic if partial_removals missing (fallback)
            console.log('[CANCEL] Legacy Partial cancellation for booking', booking_id);
            await Booking.updateOne({ booking_id }, { status: 'cancelled' });
        } else {
            // ┌─────────────────────────────────────────────────────┐
            // │ FULL CANCELLATION: Mark entire booking as cancelled  │
            // └─────────────────────────────────────────────────────┘
            console.log('[CANCEL] Full cancellation for booking', booking_id);
            await Booking.updateOne({ booking_id }, { status: 'cancelled' });
        }

        // Create Notification for the user
        const room = await Room.findOne({ catalog_id: booking.catalog_id, room_id: booking.room_id }).select('room_name').lean();
        await Notification.create({
            uid: booking.uid,
            title: 'Booking Cancelled',
            message: `Your booking for ${room?.room_name || 'the room'} has been cancelled. Reason: ${cancel_reason}`,
            type: 'booking',
            booking_id
        }).catch(e => console.error('Failed to create notification:', e));

        // Notify Admins of Cancellation Record
        const cancellingUser = await User.findOne({ uid: cancelled_by_uid }).select('name').lean();
        const actionType = partial ? 'Partial Cancellation' : 'Full Cancellation';
        await notifyAdmins(
            `Booking ${actionType}`,
            `${actionType} recorded by ${cancellingUser?.name || 'a user'} for booking ${booking_id}. Reason: ${cancel_reason}`,
            'booking',
            booking_id
        );

        res.status(201).json({ message: 'Cancellation recorded.', cancel_id });
    } catch (error) {
        console.error('Error creating cancellation:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
