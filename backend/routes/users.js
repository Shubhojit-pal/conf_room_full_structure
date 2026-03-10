/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USER MANAGEMENT ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Handle user profile management and admin user management
 * 
 * Routes:
 *  - GET    /api/users                (Admin) Get all users
 *  - GET    /api/users/:uid           (Protected) Get single user profile
 *  - PUT    /api/users/:uid           (Protected) Update user profile
 *  - DELETE /api/users/:uid           (Admin) Delete user account
 * 
 * Authorization:
 *  - All routes require valid JWT token (authMiddleware)
 *  - Users can only access/modify their own profile
 *  - Admins can access/modify any user profile
 *  - Admin routes also require admin role (adminOnly middleware)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const User = require('../models/User');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users (ADMIN ONLY)
 * 
 * Purpose: Retrieve list of all users in the system
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Success Response (200):
 *  [
 *    {
 *      "uid": "U-001",
 *      "userrole_id": "user",
 *      "name": "John Doe",
 *      "email": "john@example.com",
 *      "dept": "Engineering",
 *      "phone_no": "+1234567890"
 *    },
 *    ...
 *  ]
 * 
 * Error Responses:
 *  - 401: No valid token
 *  - 403: Not admin
 *  - 500: Server error
 */
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        // Fetch all users, sorted alphabetically by name
        // Password field excluded by default in Mongoose schema .select()
        const users = await User.find()
            .select('uid userrole_id name email dept phone_no')
            .sort({ name: 1 }) // Sort alphabetically
            .lean(); // Read-only query, better performance
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/users/:uid (PROTECTED)
 * 
 * Purpose: Retrieve a specific user's profile
 * 
 * URL Parameters:
 *  - uid: User identifier (e.g., "U-001")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - User can only view their own profile OR user is admin
 *  - Access control enforced: req.user.uid must match uid param or be admin
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
 *  - 401: No valid token
 *  - 403: Access denied (not own profile and not admin)
 *  - 404: User not found
 *  - 500: Server error
 */
router.get('/:uid', authMiddleware, async (req, res) => {
    const { uid } = req.params;
    
    // Verify user is accessing own profile or is admin
    if (req.user.userrole_id !== 'admin' && req.user.uid !== uid) {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const user = await User.findOne({ uid })
            .select('uid userrole_id name email dept phone_no')
            .lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/users/:uid (PROTECTED)
 * 
 * Purpose: Update a user's profile information
 * 
 * URL Parameters:
 *  - uid: User identifier (e.g., "U-001")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - User can only update their own profile OR user is admin
 *  - Access control enforced: req.user.uid must match uid param or be admin
 * 
 * Updatable Fields (JSON Body):
 *  - name: User's full name
 *  - dept: Department/organization unit
 *  - phone_no: Contact phone number
 * 
 * Fields NOT updatable (for security):
 *  - email, password, uid, userrole_id
 *  - Password changes should use separate endpoint
 * 
 * Success Response (200):
 *  {
 *    "message": "Profile updated successfully."
 *  }
 * 
 * Error Responses:
 *  - 401: No valid token
 *  - 403: Access denied (not own profile and not admin)
 *  - 404: User not found
 *  - 500: Server error
 */
router.put('/:uid', authMiddleware, async (req, res) => {
    const { uid } = req.params;
    
    // Verify user is updating own profile or is admin
    if (req.user.userrole_id !== 'admin' && req.user.uid !== uid) {
        return res.status(403).json({ error: 'Access denied.' });
    }

    const { name, dept, phone_no } = req.body;

    try {
        // Update only specified fields
        const result = await User.findOneAndUpdate(
            { uid },
            { name, dept, phone_no },
            { new: true } // Return updated document
        );
        if (!result) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/users/:uid (ADMIN ONLY)
 * 
 * Purpose: Remove a user account from the system
 * 
 * URL Parameters:
 *  - uid: User identifier (e.g., "U-001")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Warning: 
 *  - This is a hard delete of user account
 *  - All associated bookings should be handled first
 *  - Consider soft delete for production systems
 * 
 * Success Response (200):
 *  {
 *    "message": "User deleted successfully."
 *  }
 * 
 * Error Responses:
 *  - 401: No valid token
 *  - 403: Not admin
 *  - 404: User not found
 *  - 500: Server error
 */
router.delete('/:uid', authMiddleware, adminOnly, async (req, res) => {
    const { uid } = req.params;
    try {
        const result = await User.findOneAndDelete({ uid });
        if (!result) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
