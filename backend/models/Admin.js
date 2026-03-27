/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Define structure of Admin documents — COMPLETELY SEPARATE from
 *          the users collection. Admins are never mixed with regular users.
 * Collection: "admins"
 *
 * Fields:
 *  - admin_id: Unique admin identifier (auto-generated: A-01, A-02...)
 *  - name: Full name of the admin
 *  - email: Email address (unique, used for login)
 *  - password: bcrypt hashed password
 *  - phone_no: Contact phone number (unique)
 *  - dept: Department/team
 *  - role: 'location_admin' | 'super_admin'
 *  - assigned_locations: Array of location_id strings this admin can manage
 *                        (empty array = no restriction, used for super_admin)
 *  - isActive: Enable/disable the admin account (default: true)
 *
 * Roles:
 *  - super_admin:    Full access to all locations, can manage other admins
 *  - location_admin: Access restricted to rooms & bookings in assigned_locations
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

const adminSchema = new mongoose.Schema({
    /**
     * admin_id: Unique identifier for each admin
     * Auto-generated format: A-01, A-02, A-03...
     */
    admin_id: { type: String, unique: true },

    /**
     * name: Admin's full name
     */
    name: { type: String, required: true },

    /**
     * email: Admin's email for login (unique, case-insensitive)
     */
    email: {
        type: String,
        required: true,
        unique: true,
        set: (v) => v.toLowerCase(),
    },

    /**
     * password: bcrypt hashed password — NEVER store plain text
     */
    password: { type: String, required: true },

    /**
     * phone_no: Contact phone number (unique)
     */
    phone_no: { type: String, required: true, unique: true },

    /**
     * dept: Department or team
     */
    dept: { type: String },

    /**
     * role: Admin's role in the system
     * 'location_admin' — scoped to assigned_locations
     * 'super_admin'    — unrestricted access
     */
    role: {
        type: String,
        required: true,
        enum: ['location_admin', 'super_admin'],
        default: 'location_admin',
    },

    /**
     * assigned_locations: List of location_id values this admin can manage.
     * For super_admin this is typically empty (meaning no restriction).
     * For location_admin this must contain at least one location_id.
     */
    assigned_locations: { type: [String], default: [] },

    /**
     * isActive: Whether this admin account is enabled.
     * Set to false to disable without deleting.
     */
    isActive: { type: Boolean, default: true },

}, { timestamps: true });

// Pre-save hook: auto-generate admin_id if not provided
adminSchema.pre('save', async function () {
    if (!this.admin_id) {
        try {
            const latest = await this.constructor.findOne().sort({ createdAt: -1 });
            if (latest && latest.admin_id) {
                const match = latest.admin_id.match(/A-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    this.admin_id = `A-${String(nextNum).padStart(2, '0')}`;
                } else {
                    this.admin_id = 'A-01';
                }
            } else {
                this.admin_id = 'A-01';
            }
        } catch (error) {
            throw error;
        }
    }
});

module.exports = mongoose.model('Admin', adminSchema);
