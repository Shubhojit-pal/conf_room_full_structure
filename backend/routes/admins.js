/**
 * ADMIN ROUTES - /api/admins
 *
 * Handles admin account management and admin login.
 * Admin accounts live in their own separate 'admins' collection.
 *
 * Routes:
 *   POST   /api/admins/login        Public — Admin login
 *   GET    /api/admins/me           Protected — Own profile
 *   GET    /api/admins              super_admin — List all admins
 *   POST   /api/admins              super_admin — Create admin
 *   PUT    /api/admins/:id          super_admin — Update admin
 *   DELETE /api/admins/:id          super_admin — Deactivate admin
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { adminAuthMiddleware, superAdminOnly } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────
// POST /api/admins/login  (PUBLIC)
// Admin login — queries admins collection only
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const admin = await Admin.findOne({ email: email.toLowerCase() });

        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!admin.isActive) {
            return res.status(403).json({ error: 'Admin account is disabled.' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // JWT payload includes role and assigned_locations so middleware
        // can enforce access control without a DB round-trip on every request.
        const token = jwt.sign(
            {
                admin_id: admin.admin_id,
                role: admin.role,
                assigned_locations: admin.assigned_locations,
                name: admin.name,
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful.',
            token,
            admin: {
                admin_id: admin.admin_id,
                name: admin.name,
                email: admin.email,
                dept: admin.dept,
                phone_no: admin.phone_no,
                role: admin.role,
                assigned_locations: admin.assigned_locations,
            },
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// GET /api/admins/me  (PROTECTED — any admin)
// Returns the currently authenticated admin's profile
// ─────────────────────────────────────────────
router.get('/me', adminAuthMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findOne({ admin_id: req.admin.admin_id })
            .select('-password')
            .lean();

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found.' });
        }

        res.json(admin);
    } catch (error) {
        console.error('Admin me error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// GET /api/admins  (super_admin only)
// List all admin accounts
// ─────────────────────────────────────────────
router.get('/', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
        const admins = await Admin.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
        res.json(admins);
    } catch (error) {
        console.error('Fetch admins error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// POST /api/admins  (super_admin only)
// Create a new admin account
// ─────────────────────────────────────────────
router.post('/', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const { name, email, password, phone_no, dept, role, assigned_locations } = req.body;

    if (!name || !email || !password || !phone_no || !role) {
        return res.status(400).json({ error: 'name, email, password, phone_no, and role are required.' });
    }

    if (!['location_admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ error: 'role must be location_admin or super_admin.' });
    }

    try {
        const existing = await Admin.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'An admin with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await Admin.create({
            name,
            email,
            password: hashedPassword,
            phone_no,
            dept,
            role,
            assigned_locations: assigned_locations || [],
            isActive: true,
        });

        res.status(201).json({
            message: 'Admin created successfully.',
            admin_id: admin.admin_id,
        });
    } catch (error) {
        console.error('Create admin error:', error);
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ error: `${field} already in use.` });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// PUT /api/admins/:id  (super_admin only)
// Update admin — role, assigned_locations, isActive
// ─────────────────────────────────────────────
router.put('/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const { id } = req.params;
    const { name, phone_no, dept, role, assigned_locations, isActive, password } = req.body;

    try {
        const admin = await Admin.findOne({ admin_id: id });
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found.' });
        }

        if (name !== undefined) admin.name = name;
        if (phone_no !== undefined) admin.phone_no = phone_no;
        if (dept !== undefined) admin.dept = dept;
        if (role !== undefined) {
            if (!['location_admin', 'super_admin'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role.' });
            }
            admin.role = role;
        }
        if (assigned_locations !== undefined) admin.assigned_locations = assigned_locations;
        if (isActive !== undefined) admin.isActive = isActive;
        if (password) {
            admin.password = await bcrypt.hash(password, 10);
        }

        await admin.save();
        res.json({ message: 'Admin updated successfully.' });
    } catch (error) {
        console.error('Update admin error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/admins/:id  (super_admin only)
// Deactivates admin (soft delete — sets isActive: false)
// ─────────────────────────────────────────────
router.delete('/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const { id } = req.params;

    try {
        // Prevent deleting yourself
        if (req.admin.admin_id === id) {
            return res.status(400).json({ error: 'You cannot deactivate your own account.' });
        }

        const admin = await Admin.findOne({ admin_id: id });
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found.' });
        }

        admin.isActive = false;
        await admin.save();

        res.json({ message: 'Admin deactivated successfully.' });
    } catch (error) {
        console.error('Delete admin error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
