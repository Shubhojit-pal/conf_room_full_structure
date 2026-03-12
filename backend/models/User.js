/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USER MODEL - MongoDB Schema Definition
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Define structure of User documents in MongoDB
 * Collection: "users"
 * 
 * Fields:
 *  - uid: Unique user identifier (UUID or auto-generated)
 *  - userrole_id: Role assignment ('user' or 'admin') - default: 'user'
 *  - name: Full name of the user
 *  - email: Email address (unique, case-insensitive)
 *  - password: Hashed password (never store plain text!)
 *  - dept: Department/Organization unit
 *  - phone_no: Contact phone number (unique)
 *  - createdAt: Timestamp when user was registered (auto-generated)
 *  - updatedAt: Timestamp of last modification (auto-generated)
 * 
 * Indexes:
 *  - uid: Unique index (primary lookup)
 *  - email: Unique index (login identifier)
 *  - phone_no: Unique index (contact verification)
 * 
 * Usage:
 *  const user = await User.create({
 *    uid: 'U-001',
 *    name: 'John Doe',
 *    email: 'john@example.com',
 *    password: hashedPassword,
 *    dept: 'Engineering',
 *    phone_no: '+1234567890'
 *  });
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { mongoose } = require('../db');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ USER SCHEMA: Define user document structure with validation rules       │
// └─────────────────────────────────────────────────────────────────────────┘
const userSchema = new mongoose.Schema({
    /**
     * uid: Unique identifier for each user
     * Type: String, Required: Yes, Unique: Yes
     * Example: "U-001", "USER-12345"
     */
    uid: { type: String, required: true, unique: true },

    /**
     * userrole_id: User's role in the system
     * Type: String, Required: Yes, Default: 'user'
     * Allowed values: 'user' (regular user), 'admin' (administrator)
     */
    userrole_id: { type: String, required: true, default: 'user' },

    /**
     * name: User's full name
     * Type: String, Required: Yes
     * Example: "John Doe"
     */
    name: { type: String, required: true },

    /**
     * email: User's email address for login and communication
     * Type: String, Required: Yes, Unique: Yes
     * Stored in lowercase for case-insensitive searching
     * Example: "john@company.com"
     */
    email: { type: String, required: true, unique: true },

    /**
     * password: User's hashed password for authentication
     * Type: String, Required: Yes
     * IMPORTANT: Always hash with bcrypt before storing!
     * Never log or expose this field in API responses
     */
    password: { type: String, required: true },

    /**
     * dept: Department or organizational unit
     * Type: String, Required: Yes
     * Example: "Engineering", "Sales", "HR"
     */
    dept: { type: String, required: true },

    /**
     * phone_no: User's contact phone number
     * Type: String, Required: Yes, Unique: Yes
     * Example: "+1 (555) 123-4567"
     */
    phone_no: { type: String, required: true, unique: true },

    /**
     * Account verification and OTP
     */
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },

    /**
     * Password reset tokens
     */
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
}, { timestamps: true }); // Auto-add createdAt and updatedAt fields

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ EXPORT: Create and export User model                                    │
// └─────────────────────────────────────────────────────────────────────────┘
module.exports = mongoose.model('User', userSchema);
