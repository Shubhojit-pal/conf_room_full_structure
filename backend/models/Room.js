/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROOM MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Define structure of Conference Room documents in MongoDB
 * Collection: "rooms"
 * 
 * Fields:
 *  - catalog_id: Catalog reference ID (auto-generated, format: CAT-01, CAT-02...)
 *  - room_id: Room identifier (auto-generated, format: R-01, R-02...)
 *  - room_name: Display name of the room
 *  - capacity: Maximum number of people
 *  - location: Physical location/building
 *  - amenities: List of amenities (projector, video conference, etc.)
 *  - status: Room operational status ('active', 'inactive', 'maintenance')
 *  - floor_no: Floor number where room is located
 *  - room_number: Physical room number
 *  - image_url: URL to room photo/image
 *  - availability: Availability status ('available', 'unavailable')
 *  - createdAt: Timestamp when room was added (auto-generated)
 *  - updatedAt: Timestamp of last modification (auto-generated)
 * 
 * Unique Constraint:
 *  - Composite key: (catalog_id, room_id) must be unique
 * 
 * Auto-Generation:
 *  - catalog_id: Pre-save hook generates sequential IDs (CAT-01, CAT-02...)
 *  - room_id: Pre-save hook generates sequential IDs (R-01, R-02...)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ROOM SCHEMA: Define room document structure with validation              │
// └─────────────────────────────────────────────────────────────────────────┘
const roomSchema = new mongoose.Schema({
    /**
     * catalog_id: Catalog/batch identifier for the room
     * Type: String
     * Auto-generated format: CAT-01, CAT-02, CAT-03...
     * Used for grouping rooms by catalog/building
     */
    catalog_id: { type: String },

    /**
     * room_id: Unique room identifier within catalog
     * Type: String
     * Auto-generated format: R-01, R-02, R-03...
     * Used for booking and availability tracking
     */
    room_id: { type: String },

    /**
     * room_name: Display name/label of the room
     * Type: String, Required: Yes
     * Example: "Conference Room A", "Board Room", "Training Hall 1"
     */
    room_name: { type: String, required: true },

    /**
     * capacity: Maximum seating capacity
     * Type: Number
     * Example: 10, 25, 50 (number of people)
     * Used for validation when booking attendees
     */
    capacity: { type: Number },

    /**
     * location: Physical location details
     * Type: String
     * Example: "Building A, Wing 3", "Main Floor"
     * Helps users navigate to room
     */
    location: { type: String },

    /**
     * amenities: Equipment and facilities available
     * Type: String (comma-separated or JSON)
     * Example: "Projector, Video Conference, Whiteboard"
     * Helps users filter rooms by required equipment
     */
    amenities: { type: String },

    /**
     * status: Operational status of room
     * Type: String, Default: 'active'
     * Allowed values: 'active', 'inactive', 'maintenance'
     * 'inactive' rooms cannot be booked
     */
    status: { type: String, default: 'active' },

    /**
     * floor_no: Building floor number
     * Type: Number
     * Example: 1, 2, 3, -1 (basement)
     * Helps users locate floor
     */
    floor_no: { type: Number },

    /**
     * room_number: Official room number
     * Type: String
     * Example: "101", "3B", "L-201"
     * Often used on office signage
     */
    room_number: { type: String },

    /**
     * image_url: URL to room image (legacy/primary)
     * Type: String
     * Example: "/uploads/room-1234567890.jpg"
     * Displayed in UI for room preview (backwards compatibility)
     */
    image_url: { type: String },

    /**
     * image_urls: List of URLs for room gallery
     * Type: Array of Strings
     * Used for slideshow/gallery view
     */
    image_urls: { type: [String], default: [] },

    /**
     * availability: Quick availability indicator
     * Type: String, Default: 'available'
     * Allowed values: 'available', 'unavailable'
     * Can be used for quick filtering in UI
     */
    /**
     * room_type: Biological room classification (Meeting, Conference, etc.)
     * Type: String
     * Example: "Conference Room", "Meeting Room", "Training Room"
     */
    room_type: { type: String, default: 'Conference Room' },

    /**
     * mapLink: Google Maps location link
     * Type: String
     * Example: "https://maps.google.com/?q=22.5726,88.3639"
     */
    mapLink: { type: String },

    /**
     * location_id: References the Location document for this room.
     * Used for access-control — location_admin can only manage rooms
     * whose location_id is in their assigned_locations array.
     * Example: "L-01", "L-02"
     */
    location_id: { type: String },

    /**
     * layout: Visual room layout data designed by admin
     * Type: Mixed (JSON object containing grid elements)
     * Example: { rows: 8, cols: 10, elements: [{type:'seat', x:2, y:1}, ...] }
     * If null, no layout is configured for this room.
     */
    layout: { type: mongoose.Schema.Types.Mixed, default: null },

    /**
     * policy_pdf: URL or local path to the room's booking policy PDF
     * Type: String
     * Example: "/uploads/policy-room-R-01.pdf"
     */
    policy_pdf: { type: String },
}, { timestamps: true }); // Auto-add createdAt and updatedAt fields

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ UNIQUE INDEX: Ensure catalog_id + room_id combination is unique         │
// │ This prevents duplicate rooms in the same catalog                       │
// └─────────────────────────────────────────────────────────────────────────┘
roomSchema.index({ catalog_id: 1, room_id: 1 }, { unique: true });

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ PRE-SAVE HOOK: Auto-generate catalog_id and room_id if not provided     │
// │                                                                           │
// │ Logic:                                                                    │
// │  1. Query latest room by createdAt date                                  │
// │  2. Extract numeric portion from existing IDs                            │
// │  3. Increment number and format with zero-padding                        │
// │  4. Generate new sequential IDs (CAT-01, CAT-02... or R-01, R-02...)    │
// │                                                                           │
// │ This ensures IDs are always sequential and human-readable                │
// └─────────────────────────────────────────────────────────────────────────┘
roomSchema.pre('save', async function () {
    // Sync image_url with first element of image_urls for backward compatibility
    if (this.image_urls && this.image_urls.length > 0) {
        this.image_url = this.image_urls[0];
    } else if (this.image_url && (!this.image_urls || this.image_urls.length === 0)) {
        this.image_urls = [this.image_url];
    }

    if (!this.catalog_id || !this.room_id) {
        try {
            // Find the room with the latest createdAt date
            const latestRoom = await this.constructor.findOne().sort({ createdAt: -1 });

            // Auto-generate catalog_id if not provided
            if (!this.catalog_id) {
                if (latestRoom && latestRoom.catalog_id) {
                    // Extract numeric portion: CAT-01 → "01" → 1
                    const match = latestRoom.catalog_id.match(/CAT-(\d+)/);
                    if (match) {
                        const nextNum = parseInt(match[1]) + 1;
                        this.catalog_id = `CAT-${String(nextNum).padStart(2, '0')}`;
                    } else {
                        this.catalog_id = 'CAT-01';
                    }
                } else {
                    this.catalog_id = 'CAT-01';
                }
            }

            // Auto-generate room_id if not provided
            if (!this.room_id) {
                if (latestRoom && latestRoom.room_id) {
                    // Extract numeric portion: R-01 → "01" → 1
                    const match = latestRoom.room_id.match(/R-(\d+)/);
                    if (match) {
                        const nextNum = parseInt(match[1]) + 1;
                        this.room_id = `R-${String(nextNum).padStart(2, '0')}`;
                    } else {
                        this.room_id = 'R-01';
                    }
                } else {
                    this.room_id = 'R-01';
                }
            }
        } catch (error) {
            // In async hooks, throwing an error will abort the save
            throw error;
        }
    }
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ EXPORT: Create and export Room model                                    │
// └─────────────────────────────────────────────────────────────────────────┘
module.exports = mongoose.model('Room', roomSchema);
