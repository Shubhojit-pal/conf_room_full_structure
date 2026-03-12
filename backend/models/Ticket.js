/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TICKET MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Define structure of Booking Confirmation Ticket documents
 * Collection: "tickets"
 * 
 * A Ticket is a confirmation document for a successful booking.
 * It serves as proof of reservation and can be downloaded/shared.
 * 
 * Fields:
 *  - ticket_id: Unique ticket identifier (format: T-02-123)
 *  - booking_id: Reference to associated booking
 *  - uid: User who owns this ticket
 *  - createdAt: When ticket was issued (auto-generated)
 *  - updatedAt: Last modification timestamp (auto-generated)
 * 
 * Ticket ID Format:
 *  - T-<booking_id_number>-<random_3_digits>
 *  - Example: T-02-487 (booking B-02, random 487)
 *  - Ensures uniqueness and traceability
 * 
 * Relationships:
 *  - References Booking via booking_id (1-to-1 relationship)
 *  - References User via uid (1-to-many relationship)
 * 
 * Usage:
 *  1. User creates booking successfully
 *  2. System generates ticket with booking_id
 *  3. Ticket displayed to user with all booking details
 *  4. User can download ticket as PDF
 *  5. User can view ticket history in "My Bookings"
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ TICKET SCHEMA: Define ticket document structure with validation          │
// └─────────────────────────────────────────────────────────────────────────┘
const ticketSchema = new mongoose.Schema({
    /**
     * ticket_id: Unique identifier for confirmation ticket
     * Type: String, Required: Yes, Unique: Yes
     * Format: T-<booking_number>-<random_digits>
     * Example: T-02-487, T-15-923
     * Used for ticket lookup and reference
     */
    ticket_id: { type: String, required: true, unique: true },

    /**
     * booking_id: Reference to the booking this ticket confirms
     * Type: String, Required: Yes
     * Links to Booking.booking_id (1-to-1 relationship)
     * Example: "B-02"
     * Every booking should have exactly one ticket
     */
    booking_id: { type: String, required: true },

    /**
     * uid: User who owns this ticket
     * Type: String, Required: Yes
     * Links to User.uid (1-to-many relationship)
     * Example: "U-001"
     * User can have multiple tickets (multiple bookings)
     */
    uid: { type: String, required: true },
}, { timestamps: true }); // Auto-add createdAt and updatedAt fields

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ EXPORT: Create and export Ticket model                                  │
// └─────────────────────────────────────────────────────────────────────────┘
module.exports = mongoose.model('Ticket', ticketSchema);
