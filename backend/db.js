/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MONGODB CONNECTION MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Establish and maintain connection to MongoDB Atlas
 * 
 * Responsibilities:
 *  - Initialize MongoDB connection with Mongoose
 *  - Configure connection pooling & timeouts
 *  - Implement automatic reconnection logic
 *  - Handle connection lifecycle events
 *  - Provide connection state monitoring
 * 
 * Environment Variables:
 *  - MONGO_URI: MongoDB Atlas connection string (required)
 *              Format: mongodb+srv://username:password@cluster.mongodb.net/dbname
 * 
 * Connection Options:
 *  - serverSelectionTimeoutMS: 10 seconds to find a MongoDB server
 *  - socketTimeoutMS: 45 seconds idle timeout for socket
 *  - heartbeatFrequencyMS: Ping server every 10 seconds to keep connection alive
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ENVIRONMENT VALIDATION: Ensure MONGO_URI is set before proceeding       │
// └─────────────────────────────────────────────────────────────────────────┘
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ Missing MONGO_URI in .env');
    process.exit(1);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ CONNECTION CONFIGURATION: Set Mongoose connection options               │
// │                                                                           │
// │ serverSelectionTimeoutMS: How long to wait for initial connection       │
// │ socketTimeoutMS: How long before idle sockets disconnect                │
// │ heartbeatFrequencyMS: How often to ping MongoDB to keep alive           │
// └─────────────────────────────────────────────────────────────────────────┘
const MONGOOSE_OPTS = {
    serverSelectionTimeoutMS: 10000,  // 10 seconds to find a server
    socketTimeoutMS: 45000,           // 45 seconds socket idle timeout
    heartbeatFrequencyMS: 10000,      // Ping every 10 seconds to keep connection alive
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ CONNECTION FUNCTION: Establish connection to MongoDB                    │
// │                                                                           │
// │ - Attempts initial connection                                            │
// │ - On failure: logs error and retries after 5 seconds                    │
// │ - Continues retrying indefinitely until successful                      │
// └─────────────────────────────────────────────────────────────────────────┘
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, MONGOOSE_OPTS);
        console.log('✅ MongoDB Atlas connected successfully!');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);  // Automatically retry connection
    }
};

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ CONNECTION EVENT HANDLERS: Monitor connection lifecycle events          │
// │                                                                           │
// │ 'disconnected': Fired when connection drops (network issues, etc.)      │
// │                 Automatically attempt to reconnect after 5 seconds      │
// │                                                                           │
// │ 'error': Fired when a connection error occurs                           │
// │         Log error details for debugging                                 │
// └─────────────────────────────────────────────────────────────────────────┘

// Automatically reconnect if connection drops unexpectedly
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Reconnecting...');
    setTimeout(connectDB, 5000);
});

// Log any connection errors
mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ EXPORTS: Provide connection function and Mongoose instance              │
// │                                                                           │
// │ connectDB: Function to initiate database connection                     │
// │ mongoose: Instance for creating/accessing models                        │
// └─────────────────────────────────────────────────────────────────────────┘
module.exports = { connectDB, mongoose };
