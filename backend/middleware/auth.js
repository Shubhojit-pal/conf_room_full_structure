/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTHENTICATION & AUTHORIZATION MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Functions:
 *  1. authMiddleware       - Validates JWT for regular users (unchanged)
 *  2. adminOnly            - Legacy: checks userrole_id === 'admin' (kept for compat)
 *  3. adminAuthMiddleware  - Validates JWT for admin accounts (new admins collection)
 *  4. superAdminOnly       - Requires role === 'super_admin'
 *  5. anyAdminOnly         - Requires role === 'location_admin' or 'super_admin'
 *  6. locationAdminGuard   - Factory: returns middleware that checks location ownership
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const jwt = require('jsonwebtoken');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ authMiddleware: Authenticate regular USERS via JWT                      │
// └─────────────────────────────────────────────────────────────────────────┘
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { uid, userrole_id, name }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ adminOnly: Legacy guard — kept for backward compatibility               │
// │ Checks if req.user.userrole_id === 'admin'                             │
// └─────────────────────────────────────────────────────────────────────────┘
const adminOnly = (req, res, next) => {
    if (req.user?.userrole_id !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ adminAuthMiddleware: Authenticate ADMIN accounts (new admins collection)│
// │                                                                          │
// │ Sets req.admin = { admin_id, role, assigned_locations, name }           │
// │ Must be used INSTEAD OF authMiddleware on admin-only routes             │
// └─────────────────────────────────────────────────────────────────────────┘
const adminAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No admin token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure this token is from the admins collection (has 'role' field, not 'userrole_id')
        if (!decoded.role || !['location_admin', 'super_admin'].includes(decoded.role)) {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        req.admin = decoded; // { admin_id, role, assigned_locations, name }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired admin token.' });
    }
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ superAdminOnly: Allow only super_admin role                             │
// │ Must be called AFTER adminAuthMiddleware                                │
// └─────────────────────────────────────────────────────────────────────────┘
const superAdminOnly = (req, res, next) => {
    if (req.admin?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Super admin access required.' });
    }
    next();
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ anyAdminOnly: Allow location_admin OR super_admin                       │
// │ Must be called AFTER adminAuthMiddleware                                │
// └─────────────────────────────────────────────────────────────────────────┘
const anyAdminOnly = (req, res, next) => {
    if (!req.admin || !['location_admin', 'super_admin'].includes(req.admin.role)) {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ locationAdminGuard: Factory function — returns middleware that checks   │
// │ whether the admin owns the given location.                              │
// │                                                                          │
// │ Usage:                                                                   │
// │   router.put('/rooms/:id', adminAuthMiddleware, anyAdminOnly,           │
// │     locationAdminGuard((req) => req.body.location_id), handler)         │
// │                                                                          │
// │ Rules:                                                                   │
// │   - super_admin: always passes                                           │
// │   - location_admin: passes only if location_id is in assigned_locations │
// │                                                                          │
// │ @param {Function} getLocationId - Function(req) returning location_id   │
// └─────────────────────────────────────────────────────────────────────────┘
const locationAdminGuard = (getLocationId) => (req, res, next) => {
    if (!req.admin) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    // super_admin bypasses all location checks
    if (req.admin.role === 'super_admin') {
        return next();
    }

    const locationId = getLocationId(req);

    if (!locationId) {
        // If no location_id provided, location_admin is blocked
        return res.status(400).json({ error: 'location_id is required for location admins.' });
    }

    if (!req.admin.assigned_locations.includes(locationId)) {
        return res.status(403).json({
            error: 'Access denied. You do not manage this location.',
        });
    }

    next();
};

module.exports = {
    authMiddleware,
    adminOnly,
    adminAuthMiddleware,
    superAdminOnly,
    anyAdminOnly,
    locationAdminGuard,
};
