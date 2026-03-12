/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFERENCE ROOM BOOKING SYSTEM - EXPRESS SERVER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Main Express server initialization and route configuration
 * 
 * Technology Stack:
 *  - Express: Web framework for handling HTTP requests
 *  - CORS: Cross-Origin Resource Sharing middleware
 *  - Mongoose: MongoDB object modeling
 *  - JWT: Token-based authentication
 * 
 * Environment Variables Required:
 *  - MONGO_URI: MongoDB connection string
 *  - JWT_SECRET: Secret key for token signing
 *  - PORT: Server port (default: 5000)
 * 
 * Main Routes:
 *  - GET  /                      (Welcome message)
 *  - GET  /api/health            (Health check endpoint)
 *  - GET  /api/test-db           (Database connection test)
 *  - POST /api/auth/*            (User authentication routes)
 *  - GET  /api/rooms/*           (Room management routes)
 *  - POST /api/bookings/*        (Booking management routes)
 *  - GET  /api/users/*           (User management routes)
 *  - POST /api/cancellations/*   (Cancellation routes)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
// Load environment variables from .env file
dotenv.config();

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ FILE SYSTEM SETUP: Ensure uploads directory exists for image storage   │
// └─────────────────────────────────────────────────────────────────────────┘
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log('✅ Created uploads directory');
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DATABASE CONNECTION: Initialize MongoDB connection                      │
// └─────────────────────────────────────────────────────────────────────────┘
const { connectDB } = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ MIDDLEWARE CONFIGURATION: Enable CORS and JSON parsing                  │
// │                                                                           │
// │ CORS Allowlist: set ALLOWED_ORIGINS in .env as a comma-separated list   │
// │ e.g. ALLOWED_ORIGINS=https://myapp.vercel.app,https://myadmin.vercel.app│
// └─────────────────────────────────────────────────────────────────────────┘
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

// Always allow localhost for local development
const DEFAULT_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., Postman, curl, server-to-server)
        if (!origin) return callback(null, true);
        const allowed = [...DEFAULT_DEV_ORIGINS, ...ALLOWED_ORIGINS];
        if (allowed.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked origin: ${origin}`);
            callback(new Error(`CORS policy: origin ${origin} not allowed`));
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WELCOME ROUTE: Main entry point with API information                    │
// └─────────────────────────────────────────────────────────────────────────┘
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Conference Room Booking System API',
        frontends: {
            user: 'http://localhost:5173',
            admin: 'http://localhost:3001'
        },
        health: 'http://127.0.0.1:5000/api/health'
    });
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ROUTE IMPORTS: Import all API route handlers                            │
// └─────────────────────────────────────────────────────────────────────────┘
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const cancellationRoutes = require('./routes/cancellations');
const notificationRoutes = require('./routes/notifications');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ROUTE MOUNTING: Register all route handlers with API prefix             │
// └─────────────────────────────────────────────────────────────────────────┘
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cancellations', cancellationRoutes);
app.use('/api/notifications', notificationRoutes);

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DIAGNOSTIC ROUTES: Used for testing system components                   │
// └─────────────────────────────────────────────────────────────────────────┘
app.get('/api/test-email', async (req, res) => {
    const { sendOtpEmail } = require('./utils/mail');
    const testEmail = req.query.email || 'shubhojitpal2001@gmail.com';
    try {
        console.log(`[DIAGNOSTIC] Manual email test for: ${testEmail}`);
        const result = await sendOtpEmail(testEmail, '123456', 'registration');
        if (result) {
            res.json({ status: 'success', message: `Test email sent to ${testEmail}. Check your inbox!` });
        } else {
            res.status(500).json({ status: 'error', message: 'Failed to send email. Check backend terminal for errors.' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DATABASE HEALTH CHECK: Verify MongoDB connection status                  │
// └─────────────────────────────────────────────────────────────────────────┘
// │ MongoDB Connection States:                                               │
// │  - 0: disconnected   (No active connection)                              │
// │  - 1: connected      (Ready to query)                                    │
// │  - 2: connecting     (In progress)                                       │
// │  - 3: disconnecting  (Closing connection)                                │
// └─────────────────────────────────────────────────────────────────────────┘
app.get('/api/test-db', async (req, res) => {
    try {
        const { mongoose } = require('./db');
        const state = mongoose.connection.readyState;
        
        if (state === 1) {
            res.json({ success: true, message: '✅ MongoDB connected!' });
        } else {
            res.status(500).json({ success: false, message: '❌ MongoDB not connected', state });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: '❌ MongoDB connection failed', error: err.message });
    }
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ HEALTH CHECK ENDPOINT: Simple endpoint to verify server is running      │
// │ Useful for monitoring and load balancer health checks                   │
// └─────────────────────────────────────────────────────────────────────────┘
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend is running', timestamp: new Date().toISOString() });
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 404 NOT FOUND HANDLER: Return 404 for undefined routes                  │
// └─────────────────────────────────────────────────────────────────────────┘
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ GLOBAL ERROR HANDLER: Catch unhandled errors and return 500 response    │
// │ This middleware must be the last app.use() call                         │
// └─────────────────────────────────────────────────────────────────────────┘
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ SERVER STARTUP: Connect to MongoDB and start listening on PORT          │
// │ All routes are now available after this starts                          │
// └─────────────────────────────────────────────────────────────────────────┘
connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on http://127.0.0.1:${PORT}`);
        console.log('   Routes: /api/auth | /api/rooms | /api/bookings | /api/users | /api/cancellations | /api/notifications');
    });
});
