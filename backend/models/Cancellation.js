/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CANCELLATION MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Track and record booking cancellations for audit and reporting
 * Collection: "cancellations"
 * 
 * A Cancellation record is created whenever a booking is fully or partially
 * cancelled. It serves as an audit trail for business intelligence and
 * cancellation policy enforcement.
 * 
 * Fields:
 *  - cancel_id: Unique cancellation identifier (format: C-01, C-02...)
 *  - booking_id: Reference to cancelled booking
 *  - cancel_reason: Explanation for cancellation
 *  - cancel_date: Date when cancellation occurred (YYYY-MM-DD)
 *  - cancel_fromdate: For partial cancellations, start date being cancelled
 *  - cancel_todate: For partial cancellations, end date being cancelled
 *  - cancel_fromtime: For partial cancellations, start time slot
 *  - cancel_totime: For partial cancellations, end time slot
 *  - cancelled_by_uid: User who initiated cancellation (user or admin)
 *  - createdAt: When cancellation record was created (auto-generated)
 *  - updatedAt: Last modification timestamp (auto-generated)
 * 
 * Cancellation Types:
 *  - Full Cancellation: Entire booking cancelled (cancel_fromdate/todate = null)
 *  - Partial Cancellation: Specific dates/slots removed (fromdate/todate populated)
 * 
 * Relationships:
 *  - References Booking via booking_id (1-to-many relationship)
 *  - References User via cancelled_by_uid (who performed cancellation)
 * 
 * Usage:
 *  1. User initiates cancellation of booking
 *  2. System creates Cancellation record with reason
 *  3. Original Booking status changed to 'cancelled'
 *  4. Record kept for audit trail and policy enforcement
 *  5. Used for financial/reporting purposes (refunds, etc.)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ CANCELLATION SCHEMA: Define cancellation document structure              │
// └─────────────────────────────────────────────────────────────────────────┘
const cancellationSchema = new mongoose.Schema({
    /**
     * cancel_id: Unique cancellation record identifier
     * Type: String, Required: Yes, Unique: Yes
     * Auto-generated format: C-01, C-02, C-03...
     * Primary lookup key for cancellation records
     */
    cancel_id: { type: String, required: true, unique: true },

    /**
     * booking_id: Reference to the booking being cancelled
     * Type: String, Required: Yes
     * Links to Booking.booking_id
     * Example: "B-02"
     * One booking can have multiple cancellation records (full + partials)
     */
    booking_id: { type: String, required: true },

    /**
     * cancel_reason: Explanation for why booking was cancelled
     * Type: String
     * User-provided reason for cancellation
     * Example: "Meeting postponed", "Client schedule conflict"
     * Required for audit purposes
     */
    cancel_reason: { type: String },

    /**
     * cancel_date: Date when cancellation was processed
     * Type: String, Required: Yes
     * Format: YYYY-MM-DD (ISO 8601)
     * Example: "2024-03-10"
     * When the cancellation action was recorded
     */
    cancel_date: { type: String, required: true },

    /**
     * cancel_fromdate: Start date for partial cancellation
     * Type: String
     * Format: YYYY-MM-DD (ISO 8601)
     * Only populated for partial cancellations
     * Example: "2024-03-16" (cancelling only this date forward)
     * Null for full cancellations
     */
    cancel_fromdate: { type: String },

    /**
     * cancel_todate: End date for partial cancellation
     * Type: String
     * Format: YYYY-MM-DD (ISO 8601)
     * Only populated for partial cancellations
     * Example: "2024-03-17" (cancelling up to this date)
     * Null for full cancellations
     */
    cancel_todate: { type: String },

    /**
     * cancel_fromtime: Start time for partial slot cancellation
     * Type: String
     * Format: HH:MM:SS (24-hour)
     * Example: "14:00:00"
     * Only populated for time-slot-specific cancellations
     * Null for full-day cancellations
     */
    cancel_fromtime: { type: String },

    /**
     * cancel_totime: End time for partial slot cancellation
     * Type: String
     * Format: HH:MM:SS (24-hour)
     * Example: "17:00:00"
     * Only populated for time-slot-specific cancellations
     * Null for full-day cancellations
     */
    cancel_totime: { type: String },

    /**
     * cancelled_by_uid: User who initiated the cancellation
     * Type: String, Required: Yes
     * Links to User.uid
     * Example: "U-001"
     * Can be the original booker or an admin
     * Used to track who cancelled and enforce policies
     */
    cancelled_by_uid: { type: String, required: true },
}, { timestamps: true }); // Auto-add createdAt and updatedAt fields

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ EXPORT: Create and export Cancellation model                            │
// └─────────────────────────────────────────────────────────────────────────┘
module.exports = mongoose.model('Cancellation', cancellationSchema);
