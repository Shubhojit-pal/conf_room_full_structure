/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOCATION MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Define structure of Location (office/site) documents in MongoDB
 * Collection: "locations"
 *
 * Fields:
 *  - location_id: Unique location identifier (auto-generated: L-01, L-02...)
 *  - name: Display name of the office (e.g. "Kolkata HQ")
 *  - address: Street address
 *  - city: City name
 *  - description: Optional notes
 *  - google_maps_url: Google Maps embed/share URL for this location
 *  - isActive: Whether this location is active (default: true)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

const locationSchema = new mongoose.Schema({
    /**
     * location_id: Unique identifier for each location
     * Type: String, Required: Yes, Unique: Yes
     * Auto-generated format: L-01, L-02, L-03...
     */
    location_id: { type: String, unique: true },

    /**
     * name: Display name of the office
     * Example: "Kolkata HQ", "Delhi Office"
     */
    name: { type: String, required: true },

    /**
     * address: Street address of the office
     */
    address: { type: String },

    /**
     * city: City where the office is located
     */
    city: { type: String },

    /**
     * description: Optional notes about this location
     */
    description: { type: String },

    /**
     * google_maps_url: Google Maps share/embed URL for the office
     * Example: "https://maps.google.com/?q=IEM+Kolkata"
     * Used to show a clickable map link in the user-facing room details page.
     */
    google_maps_url: { type: String },

    /**
     * isActive: Whether this location is operational
     */
    isActive: { type: Boolean, default: true },

}, { timestamps: true });

// Pre-save hook: auto-generate location_id if not provided
locationSchema.pre('save', async function () {
    if (!this.location_id) {
        try {
            const latest = await this.constructor.findOne().sort({ createdAt: -1 });
            if (latest && latest.location_id) {
                const match = latest.location_id.match(/L-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    this.location_id = `L-${String(nextNum).padStart(2, '0')}`;
                } else {
                    this.location_id = 'L-01';
                }
            } else {
                this.location_id = 'L-01';
            }
        } catch (error) {
            throw error;
        }
    }
});

module.exports = mongoose.model('Location', locationSchema);
