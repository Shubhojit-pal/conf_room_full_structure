/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTHENTICATION & AUTHORIZATION MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Protect routes and verify user permissions
 * 
 * Middleware Functions:
 *  1. authMiddleware: Validates JWT token from Authorization header
 *                     Extracts user info and attaches to req.user
 *                     Used on protected routes
 *  
 *  2. adminOnly: Checks if authenticated user has admin role
 *               Requires authMiddleware to be called first
 *               Used on admin-only routes
 * 
 * Token Format:
 *  Header: Authorization: Bearer <token>
 *  Token contains: { uid, userrole_id, name }
 *  Expires in: 24 hours
 * 
 * Usage in Routes:
 *  router.get('/protected', authMiddleware, (req, res) => {
 *    // user is authenticated, req.user contains decoded token
 *  });
 *  
 *  router.delete('/admin', authMiddleware, adminOnly, (req, res) => {
 *    // user is authenticated and is admin
 *  });
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const jwt = require('jsonwebtoken');

/**
 * MIDDLEWARE: Authenticate user via JWT token
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * Flow:
 *  1. Extract token from Authorization header (Bearer scheme)
 *  2. Verify token signature using JWT_SECRET
 *  3. Attach decoded user data to req.user
 *  4. Pass control to next middleware/route handler
 * 
 * Errors:
 *  - 401: No token provided or missing Authorization header
 *  - 403: Invalid or expired token
 */
const authMiddleware = (req, res, next) => {
    // Extract Authorization header (format: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Return 401 if no token found
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // Verify token signature and decode user information
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { uid, userrole_id, name }
        next(); // Pass control to next middleware/handler
    } catch (err) {
        // Return 403 if token is invalid or expired
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

/**
 * MIDDLEWARE: Authorize admin-only access
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * Requirements:
 *  - Must be called AFTER authMiddleware
 *  - Checks if req.user.userrole_id === 'admin'
 * 
 * Errors:
 *  - 403: User does not have admin role
 */
const adminOnly = (req, res, next) => {
    // Check if user role is admin
    if (req.user?.userrole_id !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next(); // User is admin, proceed
};

module.exports = { authMiddleware, adminOnly };
