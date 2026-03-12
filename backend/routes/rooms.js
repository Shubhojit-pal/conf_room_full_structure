/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROOM MANAGEMENT ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Handle conference room CRUD operations and image upload
 * 
 * Routes:
 *  - GET    /api/rooms                         (Public) Get all rooms
 *  - GET    /api/rooms/:catalog_id/:room_id    (Public) Get single room
 *  - POST   /api/rooms                         (Admin) Create new room
 *  - PUT    /api/rooms/:catalog_id/:room_id    (Admin) Update room
 *  - DELETE /api/rooms/:catalog_id/:room_id    (Admin) Delete room
 *  - POST   /api/rooms/upload-image            (Admin) Upload room image
 * 
 * Image Upload:
 *  - Multer middleware configured for disk storage in 'uploads/' folder
 *  - Supported formats: JPEG, JPG, PNG, WebP
 *  - Maximum file size: 5 MB
 *  - Files saved with timestamp + random suffix for uniqueness
 * 
 * Authorization:
 *  - Public routes: No authentication required
 *  - Admin routes: Requires valid JWT token and admin role
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const Room = require('../models/Room');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { validate } = require('../middleware/validate');
const { roomSchema, updateRoomSchema } = require('../schemas/room');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ MULTER CONFIGURATION: Setup file storage for room images                │
// │                                                                           │
// │ Storage:                                                                  │
// │  - Destination: 'uploads/' folder in project root                       │
// │  - Filename: Unique name with timestamp + random number + extension     │
// │                                                                           │
// │ Limits:                                                                   │
// │  - Max file size: 5 MB (5242880 bytes)                                   │
// │                                                                           │
// │ Validation:                                                               │
// │  - Allowed MIME types: image/jpeg, image/png, image/webp                │
// │  - Allowed extensions: .jpg, .jpeg, .png, .webp                         │
// │  - Case-insensitive extension check                                      │
// └─────────────────────────────────────────────────────────────────────────┘
const storage = multer.diskStorage({
    // Specify directory where uploaded files will be stored
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    // Generate unique filename to avoid collisions
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'room-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    // Validate file type before accepting
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed!'));
    }
});

const router = express.Router();

/**
 * POST /api/rooms/upload-image (ADMIN ONLY)
 * 
 * Purpose: Upload and store a room image in the server
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 *  - File field name must be "image"
 *  - File must be an image (JPEG, JPG, PNG, WebP)
 *  - File size must not exceed 5 MB
 * 
 * Request:
 *  - Method: POST (multipart/form-data)
 *  - Body: File uploaded with field name "image"
 * 
 * Success Response (200):
 *  {
 *    "imageUrl": "/uploads/room-1234567890-987654321.jpg"
 *  }
 * 
 * Error Responses:
 *  - 400: No file uploaded
 *  - 401/403: Missing token or insufficient permissions (middleware)
 *  - 500: Server error
 */
router.post('/upload-image', authMiddleware, adminOnly, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        // Return relative URL path that can be used in image src
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/rooms (PUBLIC)
 * 
 * Purpose: Retrieve list of all conference rooms in the system
 * 
 * Success Response (200):
 *  [
 *    {
 *      "_id": "...",
 *      "catalog_id": "CAT-01",
 *      "room_id": "R-01",
 *      "room_name": "Conference Room A",
 *      "capacity": 10,
 *      "location": "Building A, Floor 3",
 *      "amenities": "Projector, Video Conference",
 *      "status": "active",
 *      "floor_no": 3,
 *      "room_number": "301",
 *      "image_url": "/uploads/room-12345.jpg",
 *      "availability": "available",
 *      "createdAt": "2024-01-15T10:30:00Z",
 *      "updatedAt": "2024-01-15T10:30:00Z"
 *    },
 *    ...
 *  ]
 * 
 * Error Responses:
 *  - 500: Server error
 */
router.get('/', async (req, res) => {
    try {
        // Use .lean() for better performance on read-only queries
        const rooms = await Room.find().lean();
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/rooms/:catalog_id/:room_id (PUBLIC)
 * 
 * Purpose: Retrieve a specific room by catalog_id and room_id
 * 
 * URL Parameters:
 *  - catalog_id: Catalog identifier (e.g., "CAT-01")
 *  - room_id: Room identifier (e.g., "R-01")
 * 
 * Success Response (200):
 *  {
 *    "_id": "...",
 *    "catalog_id": "CAT-01",
 *    "room_id": "R-01",
 *    "room_name": "Conference Room A",
 *    "capacity": 10,
 *    ...
 *  }
 * 
 * Error Responses:
 *  - 404: Room not found
 *  - 500: Server error
 */
router.get('/:catalog_id/:room_id', async (req, res) => {
    const { catalog_id, room_id } = req.params;
    try {
        const room = await Room.findOne({ catalog_id, room_id }).lean();
        if (!room) {
            return res.status(404).json({ error: 'Room not found.' });
        }
        res.json(room);
    } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/rooms (ADMIN ONLY)
 * 
 * Purpose: Create a new conference room record
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Required Fields (JSON Body):
 *  - room_name: Display name of room
 * 
 * Optional Fields:
 *  - catalog_id: Auto-generated if not provided
 *  - room_id: Auto-generated if not provided
 *  - capacity: Maximum occupancy
 *  - location: Physical location details
 *  - amenities: Available equipment/facilities
 *  - status: Room status (default: 'active')
 *  - floor_no: Floor number
 *  - room_number: Office room number
 *  - availability: Availability status (default: 'available')
 *  - image_url: URL to room image from upload endpoint
 * 
 * Success Response (201):
 *  {
 *    "message": "Room added successfully.",
 *    "catalog_id": "CAT-01",
 *    "room_id": "R-01"
 *  }
 * 
 * Error Responses:
 *  - 400: Missing room_name
 *  - 401/403: Missing token or insufficient permissions
 *  - 500: Server error
 */
router.post('/', authMiddleware, adminOnly, validate(roomSchema), async (req, res) => {
    const { 
        catalog_id, room_id, room_name, capacity, location, amenities, 
        status, floor_no, room_number, availability, image_url 
    } = req.body;

    try {
        // Create new room with provided/auto-generated IDs
        await Room.create({
            catalog_id, 
            room_id, 
            room_name, 
            capacity, 
            location, 
            amenities,
            status: status || 'active',
            floor_no, 
            room_number, 
            image_url,
            availability: availability || 'available'
        });
        res.status(201).json({ 
            message: 'Room added successfully.', 
            catalog_id, 
            room_id 
        });
    } catch (error) {
        console.error('Error adding room:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/rooms/:catalog_id/:room_id (ADMIN ONLY)
 * 
 * Purpose: Update an existing room's details
 * 
 * URL Parameters:
 *  - catalog_id: Catalog identifier (e.g., "CAT-01")
 *  - room_id: Room identifier (e.g., "R-01")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Updatable Fields (JSON Body):
 *  - room_name, capacity, location, amenities
 *  - status, floor_no, room_number, availability, image_url
 *  - Only provided fields will be updated (partial update)
 * 
 * Success Response (200):
 *  {
 *    "message": "Room updated successfully."
 *  }
 * 
 * Error Responses:
 *  - 404: Room not found
 *  - 401/403: Missing token or insufficient permissions
 *  - 500: Server error
 */
router.put('/:catalog_id/:room_id', authMiddleware, adminOnly, validate(updateRoomSchema), async (req, res) => {
    const { catalog_id, room_id } = req.params;
    const { 
        room_name, capacity, location, amenities, status, 
        floor_no, room_number, availability, image_url 
    } = req.body;

    try {
        // Find and update room, returning updated document
        const result = await Room.findOneAndUpdate(
            { catalog_id, room_id },
            { room_name, capacity, location, amenities, status, floor_no, room_number, availability, image_url },
            { new: true } // Return updated document
        );
        if (!result) {
            return res.status(404).json({ error: 'Room not found.' });
        }
        res.json({ message: 'Room updated successfully.' });
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETEapi/rooms/:catalog_id/:room_id (ADMIN ONLY)
 * 
 * Purpose: Delete a room record from the system
 * 
 * URL Parameters:
 *  - catalog_id: Catalog identifier (e.g., "CAT-01")
 *  - room_id: Room identifier (e.g., "R-01")
 * 
 * Requirements:
 *  - Valid JWT token (authMiddleware)
 *  - Admin role (adminOnly middleware)
 * 
 * Note: Soft delete recommended for production systems to preserve
 * historical booking records. This is hard delete.
 * 
 * Success Response (200):
 *  {
 *    "message": "Room deleted successfully."
 *  }
 * 
 * Error Responses:
 *  - 404: Room not found
 *  - 401/403: Missing token or insufficient permissions
 *  - 500: Server error
 */
router.delete('/:catalog_id/:room_id', authMiddleware, adminOnly, async (req, res) => {
    const { catalog_id, room_id } = req.params;
    try {
        // Find and delete the room
        const result = await Room.findOneAndDelete({ catalog_id, room_id });
        if (!result) {
            return res.status(404).json({ error: 'Room not found.' });
        }
        res.json({ message: 'Room deleted successfully.' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
