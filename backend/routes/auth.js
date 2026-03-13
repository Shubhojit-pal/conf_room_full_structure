/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTHENTICATION ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Handle user authentication (register, login) and token management
 * 
 * Routes:
 *  - POST /api/auth/register    (Public) Register new user
 *  - POST /api/auth/login       (Public) User login, get JWT token
 *  - GET  /api/auth/me          (Protected) Get current user profile
 * 
 * Security:
 *  - Passwords hashed with bcrypt (10 salt rounds)
 *  - JWT tokens expire in 24 hours
 *  - Email stored in lowercase for case-insensitive lookup
 *  - Unique constraints on email and phone_no
 * 
 * Token Format:
 *  - Issued on successful login
 *  - Contains: { uid, userrole_id, name }
 *  - Sent in Authorization header as "Bearer <token>"
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mail');
const { validate } = require('../middleware/validate');
const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema,
    changePasswordSchema,
} = require('../schemas/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * 
 * Purpose: Register a new user account in the system
 * 
 * Required Fields (JSON Body):
 *  - uid: Unique user identifier
 *  - name: Full name
 *  - email: Email address (will be lowercased)
 *  - password: Plain text password (will be hashed)
 *  - dept: Department/organization unit
 *  - phone_no: Contact phone number
 *  - userrole_id: (optional) Role assignment, defaults to 'user'
 * 
 * Validation:
 *  - All fields except userrole_id are required
 *  - Email must be unique (case-insensitive)
 *  - Phone number must be unique
 * 
 * Success Response (201):
 *  {
 *    "message": "User registered successfully.",
 *    "uid": "U-001"
 *  }
 * 
 * Error Responses:
 *  - 400: Missing required fields
 *  - 409: Email already registered
 *  - 500: Server error
 */
router.post('/register', validate(registerSchema), async (req, res) => {
    const { uid, name, email, password, dept, phone_no } = req.body; // Explicitly ignore userrole_id from body

    try {
        // Check if email already registered
        let existing = await User.findOne({ email });
        if (existing) {
            if (existing.isVerified) {
                return res.status(409).json({ error: 'Email already registered.' });
            }
            // If they exist but aren't verified, we allow them to re-register.
            // We will update their existing record below instead of creating a new one.
        } else {
            // Also check phone number specifically if email doesn't match
            const phoneExists = await User.findOne({ phone_no });
            if (phoneExists) {
                if (phoneExists.isVerified) {
                    return res.status(409).json({ error: 'Phone number already registered.' });
                }
                existing = phoneExists; // Re-use the unverified record
            }
        }

        // Hash password with 10 salt rounds (industry standard)
        const hashedPassword = await bcrypt.hash(password, 10);
        const role = 'user'; // Hardcode all public registrations to 'user' role

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 600000; // 10 minutes

        if (existing) {
            // Update the existing unverified user record with new details and new OTP
            existing.uid = uid;
            existing.name = name;
            existing.password = hashedPassword;
            existing.dept = dept;
            existing.phone_no = phone_no;
            existing.otp = otp;
            existing.otpExpires = otpExpires;
            await existing.save();
        } else {
            // Create new user document in MongoDB (unverified)
            await User.create({
                uid,
                userrole_id: role,
                name,
                email,
                password: hashedPassword,
                dept,
                phone_no,
                isVerified: false,
                otp,
                otpExpires
            });
        }

        // Send OTP email
        const emailResult = await sendOtpEmail(email, otp, 'registration');

        if (!emailResult || !emailResult.success) {
            // Rollback the DB changes if the email fails to send
            if (existing) {
                existing.otp = undefined;
                existing.otpExpires = undefined;
                await existing.save();
            } else {
                await User.deleteOne({ email });
            }
            return res.status(500).json({
                error: 'Failed to send OTP email. Please check server email configuration.',
                details: emailResult?.error || 'Unknown error'
            });
        }

        res.status(201).json({
            message: 'OTP sent successfully. Please verify your account.',
            uid,
            email
        });
    } catch (error) {
        console.error('Register error:', error);

        // Handle MongoDB duplicate key errors (code 11000)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            if (field === 'phone_no') {
                return res.status(409).json({ error: 'Phone number already registered.' });
            }
            if (field === 'uid') {
                return res.status(409).json({ error: 'User ID already exists. Please try again.' });
            }
            return res.status(409).json({ error: `${field} already registered.` });
        }

        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/login
 * 
 * Purpose: Authenticate user and issue JWT token for subsequent requests
 * 
 * Required Fields (JSON Body):
 *  - email: Email address (will be lowercased)
 *  - password: Plain text password for verification
 * 
 * Process:
 *  1. Validate email and password provided
 *  2. Find user by email (case-insensitive)
 *  3. Compare provided password with stored hash using bcrypt
 *  4. Generate JWT token with 24-hour expiration
 *  5. Return token and user profile
 * 
 * Success Response (200):
 *  {
 *    "message": "Login successful.",
 *    "token": "<JWT_TOKEN>",
 *    "user": {
 *      "uid": "U-001",
 *      "name": "John Doe",
 *      "email": "john@example.com",
 *      "dept": "Engineering",
 *      "phone_no": "+1234567890",
 *      "userrole_id": "user"
 *    }
 *  }
 * 
 * Error Responses:
 *  - 400: Missing email or password
 *  - 401: Invalid credentials (user not found or password mismatch)
 *  - 500: Server error
 * 
 * Usage:
 *  - Store token in localStorage/sessionStorage on client
 *  - Include token in Authorization header for protected routes
 *  - Header format: "Authorization: Bearer <token>"
 */
router.post('/login', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    console.log(`[AUTH] Login attempt for email: ${email}`);

    try {
        // Find user by email in database
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`[AUTH] User not found for email: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        console.log(`[AUTH] User found: ${user.uid}, role: ${user.userrole_id}`);

        // Compare provided password with stored hash using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[AUTH] Password mismatch for user: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        console.log(`[AUTH] Login successful for user: ${email}`);

        // Generate JWT token with user information
        // Token expires in 24 hours and can be used for protected routes
        const token = jwt.sign(
            { uid: user.uid, userrole_id: user.userrole_id, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful.',
            token,
            user: {
                uid: user.uid,
                name: user.name,
                email: user.email,
                dept: user.dept,
                phone_no: user.phone_no,
                userrole_id: user.userrole_id
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/auth/me (PROTECTED)
 * 
 * Purpose: Retrieve current authenticated user's profile information
 * 
 * Requirements:
 *  - Must have valid JWT token in Authorization header
 *  - authMiddleware validates token and sets req.user
 * 
 * Success Response (200):
 *  {
 *    "uid": "U-001",
 *    "userrole_id": "user",
 *    "name": "John Doe",
 *    "email": "john@example.com",
 *    "dept": "Engineering",
 *    "phone_no": "+1234567890"
 *  }
 * 
 * Error Responses:
 *  - 401: No valid token provided (handled by authMiddleware)
 *  - 403: Invalid/expired token (handled by authMiddleware)
 *  - 404: User not found (should not happen if token is valid)
 *  - 500: Server error
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // Fetch full user profile using uid from JWT token
        const user = await User.findOne({ uid: req.user.uid })
            .select('uid userrole_id name email dept phone_no') // Exclude password
            .lean(); // Use lean() for read-only queries (faster)

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(user);
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/auth/change-password (PROTECTED)
 * 
 * Purpose: Allows an authenticated user to change their password
 */
router.put('/change-password', authMiddleware, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findOne({ uid: req.user.uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect current password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/forgot-password (PUBLIC)
 * 
 * Purpose: Generates a reset token for a user who forgot their password
 */
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Return 200 even if user not found to prevent email enumeration
            return res.json({ message: 'If an account with that email exists, a password reset token has been generated.', token: null });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB
        user.otp = otp;
        user.otpExpires = Date.now() + 600000; // 10 minutes

        await user.save();

        // Send OTP email
        const emailResult = await sendOtpEmail(email, otp, 'reset');

        if (!emailResult || !emailResult.success) {
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();
            return res.status(500).json({
                error: 'Failed to send reset email. Please check server email configuration.',
                details: emailResult?.error || 'Unknown error'
            });
        }

        res.json({
            message: 'Password reset OTP sent successfully.',
            email
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/verify-otp (PUBLIC)
 * 
 * Purpose: Verifies the OTP sent during registration
 */
router.post('/verify-otp', validate(verifyOtpSchema), async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: 'Account verified successfully. You can now log in.' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/resend-otp (PUBLIC)
 */
router.post('/resend-otp', async (req, res) => {
    const { email: rawEmail } = req.body;
    const email = rawEmail?.toLowerCase();

    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 600000;
        await user.save();

        await sendOtpEmail(email, otp, user.isVerified ? 'reset' : 'registration');
        res.json({ message: 'OTP resent successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/reset-password (PUBLIC)
 * 
 * Purpose: Resets a user's password using a valid reset token
 */
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset OTP.' });
        }

        // OTP matches and is valid; update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        // Clear OTP fields
        user.otp = undefined;
        user.otpExpires = undefined;

        await user.save();

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
