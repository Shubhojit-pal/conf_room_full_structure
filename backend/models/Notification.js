const { mongoose } = require('../db');

const notificationSchema = new mongoose.Schema({
    uid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['booking', 'system', 'reminder'], default: 'booking' },
    isRead: { type: Boolean, default: false },
    booking_id: { type: String }, // Optional reference to a booking
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
