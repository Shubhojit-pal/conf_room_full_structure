/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BOOKING MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Define structure of Conference Room Booking documents in MongoDB
 * Collection: "bookings"
 * 
 * Fields:
 *  - booking_id: Unique booking identifier (format: B-01, B-02...)
 *  - catalog_id: Reference to room catalog
 *  - room_id: Reference to specific room
 *  - uid: Reference to user who made booking
 *  - start_date: Booking period start date (YYYY-MM-DD)
 *  - end_date: Booking period end date (YYYY-MM-DD)
 *  - start_time: Time slot start (HH:MM:SS)
 *  - end_time: Time slot end (HH:MM:SS)
 *  - purpose: Reason for booking (meeting, training, etc.)
 *  - attendees: Number of people attending
 *  - status: Booking state (confirmed, rejected, cancelled)
 *  - selected_slots: Reserved time slots (comma-separated)
 *  - selected_dates: Dates included in booking (comma-separated)
 *  - createdAt: When booking was created
 *  - updatedAt: Last modification timestamp
 * 
 * Status Values:
 *  - 'confirmed': Approved and active
 *  - 'rejected': Admin rejected the booking
 *  - 'cancelled': User or admin cancelled the booking
 * 
 * Relationships:
 *  - References Room via (catalog_id, room_id)
 *  - References User via uid
 *  - Referenced by Ticket via booking_id
 *  - Referenced by Cancellation via booking_id
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ BOOKING SCHEMA: Define booking document structure with validation        │
// └─────────────────────────────────────────────────────────────────────────┘
const bookingSchema = new mongoose.Schema({
    /**
     * booking_id: Unique identifier for each booking
     * Type: String, Required: Yes, Unique: Yes
     * Auto-generated format: B-01, B-02, B-03...
     * Primary lookup key for bookings
     */
    booking_id: { type: String, required: true, unique: true },

    /**
     * catalog_id: Room catalog reference
     * Type: String, Required: Yes
     * Links to Room.catalog_id
     * Example: "CAT-01"
     */
    catalog_id: { type: String, required: true },

    /**
     * room_id: Room identifier
     * Type: String, Required: Yes
     * Links to Room.room_id
     * Combined with catalog_id to identify specific room
     * Example: "R-01"
     */
    room_id: { type: String, required: true },

    /**
     * uid: User identifier who created booking
     * Type: String, Required: Yes
     * Links to User.uid
     * Links booking to the person who reserved the room
     * Example: "U-001"
     */
    uid: { type: String, required: true },

    /**
     * start_date: Booking period start date
     * Type: String, Required: Yes
     * Format: YYYY-MM-DD (ISO 8601)
     * Example: "2024-03-15"
     * Must be <= end_date
     */
    start_date: { type: String, required: true },

    /**
     * end_date: Booking period end date
     * Type: String, Required: Yes
     * Format: YYYY-MM-DD (ISO 8601)
     * Example: "2024-03-17"
     * Must be >= start_date
     */
    end_date: { type: String, required: true },

    /**
     * start_time: Time slot start time
     * Type: String, Required: Yes
     * Format: HH:MM:SS (24-hour)
     * Example: "09:00:00", "14:30:00"
     */
    start_time: { type: String, required: true },

    /**
     * end_time: Time slot end time
     * Type: String, Required: Yes
     * Format: HH:MM:SS (24-hour)
     * Example: "10:00:00", "17:00:00"
     * Must be > start_time
     */
    end_time: { type: String, required: true },

    /**
     * purpose: Reason for booking
     * Type: String, Default: ''
     * Description of meeting/event
     * Example: "Team standup meeting", "Client presentation"
     */
    purpose: { type: String, default: '' },

    /**
     * attendees: Number of people attending
     * Type: Number, Default: 1
     * Example: 5, 15, 50
     * Must not exceed room capacity
     */
    attendees: { type: Number, default: 1 },

    /**
     * status: Booking approval status
     * Type: String, Default: 'confirmed'
     * Possible values: 'confirmed', 'confirmed', 'rejected', 'cancelled'
     * 'confirmed' = approved and active
     * 'cancelled' = user/admin cancelled
     */
    status: { type: String, default: 'confirmed' },

    /**
     * selected_slots: Reserved time slots
     * Type: String
     * Format: Comma-separated list
     * Example: "09:00:00-10:00:00,14:00:00-15:00:00"
     * Used for partial/granular slot-based bookings
     */
    selected_slots: { type: String },

    /**
     * selected_dates: Dates included in booking
     * Type: String
     * Format: Comma-separated ISO dates
     * Example: "2024-03-15,2024-03-16,2024-03-17"
     * Tracks which days within range are reserved
     */
    selected_dates: { type: String },
}, { timestamps: true }); // Auto-add createdAt and updatedAt fields

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ EXPORT: Create and export Booking model                                 │
// └─────────────────────────────────────────────────────────────────────────┘
module.exports = mongoose.model('Booking', bookingSchema);
