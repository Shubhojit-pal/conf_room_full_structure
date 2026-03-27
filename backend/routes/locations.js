/**
 * LOCATION ROUTES - /api/locations
 *
 * Manages physical office locations.
 *
 * Routes:
 *   GET    /api/locations        Any admin — list all locations
 *   POST   /api/locations        super_admin — create location
 *   PUT    /api/locations/:id    super_admin — update location
 *   DELETE /api/locations/:id    super_admin — delete/deactivate location
 */

const express = require('express');
const Location = require('../models/Location');
const { adminAuthMiddleware, superAdminOnly, anyAdminOnly } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/locations  (public / optionally admin filtered)
// List active locations (or assigned locations for location_admin)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        let filter = { isActive: true }; // Public users only see active locations
        
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            try {
                const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
                if (decoded.role === 'location_admin') {
                    filter = { location_id: { $in: decoded.assigned_locations || [] } };
                } else if (decoded.role === 'super_admin') {
                    filter = {}; // super_admin sees all, including inactive ones
                }
            } catch (err) {}
        }
        
        const locations = await Location.find(filter).sort({ location_id: 1 }).lean();
        res.json(locations);
    } catch (error) {
        console.error('Fetch locations error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// POST /api/locations  (super_admin only)
// Create a new location
// ─────────────────────────────────────────────
router.post('/', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const { name, address, city, description, google_maps_url } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'name is required.' });
    }

    try {
        const location = await Location.create({ name, address, city, description, google_maps_url });
        res.status(201).json({
            message: 'Location created successfully.',
            location_id: location.location_id,
        });
    } catch (error) {
        console.error('Create location error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// PUT /api/locations/:id  (super_admin only)
// Update a location
// ─────────────────────────────────────────────
router.put('/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const { id } = req.params;
    const { name, address, city, description, isActive, google_maps_url } = req.body;

    try {
        const location = await Location.findOne({ location_id: id });
        if (!location) {
            return res.status(404).json({ error: 'Location not found.' });
        }

        if (name !== undefined) location.name = name;
        if (address !== undefined) location.address = address;
        if (city !== undefined) location.city = city;
        if (description !== undefined) location.description = description;
        if (google_maps_url !== undefined) location.google_maps_url = google_maps_url;
        if (isActive !== undefined) location.isActive = isActive;

        await location.save();
        res.json({ message: 'Location updated successfully.' });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/locations/:id  (super_admin only)
// Deactivates a location (soft delete)
// ─────────────────────────────────────────────
router.delete('/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const { id } = req.params;

    try {
        const location = await Location.findOne({ location_id: id });
        if (!location) {
            return res.status(404).json({ error: 'Location not found.' });
        }

        location.isActive = false;
        await location.save();

        res.json({ message: 'Location deactivated successfully.' });
    } catch (error) {
        console.error('Delete location error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;