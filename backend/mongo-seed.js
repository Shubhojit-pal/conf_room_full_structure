const mongoose = require('mongoose');
const { connectDB } = require('./db');
const User = require('./models/User');
const Room = require('./models/Room');
const Booking = require('./models/Booking');
const Cancellation = require('./models/Cancellation');

const users = [
    { uid: 'U-01', userrole_id: 'admin', name: 'Admin User', email: 'admin@company.com', password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW', dept: 'IT', phone_no: '9000000001' },
    { uid: 'U-999', userrole_id: 'admin', name: 'Demo Admin', email: 'AKD1@iem.edu.in', password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW', dept: 'IT', phone_no: '0000000000' },
    { uid: 'U-02', userrole_id: 'user', name: 'Alice Johnson', email: 'alice@company.com', password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW', dept: 'Engineering', phone_no: '9000000002' },
    { uid: 'U-03', userrole_id: 'user', name: 'Bob Smith', email: 'bob@company.com', password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW', dept: 'Marketing', phone_no: '9000000003' },
    { uid: 'U-04', userrole_id: 'user', name: 'Carol Williams', email: 'carol@company.com', password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW', dept: 'HR', phone_no: '9000000004' },
    { uid: 'U-05', userrole_id: 'user', name: 'David Brown', email: 'david@company.com', password: '$2b$10$PhvHFLxgJ4FwAeWxTjZPvO7r3HBpV7eXTNyqi89VcnfrWOxK0JMcW', dept: 'Finance', phone_no: '9000000005' }
];

const rooms = [
    { catalog_id: 'CAT-01', room_id: 'R-01', room_name: 'Executive Boardroom', room_type: 'Conference Room', capacity: 20, location: 'Downtown Office', amenities: 'Projector, Video Conferencing, WiFi, AC, Audio System, Whiteboard', status: 'active', floor_no: 5, room_number: 'A501', availability: 'available' },
    { catalog_id: 'CAT-01', room_id: 'R-02', room_name: 'Innovation Hub', room_type: 'Meeting Room', capacity: 12, location: 'Tech Park Campus', amenities: 'Whiteboard, WiFi, AC, TV Screen, Video Conferencing', status: 'active', floor_no: 2, room_number: 'B201', availability: 'available' },
    { catalog_id: 'CAT-02', room_id: 'R-03', room_name: 'Quick Meet 1', room_type: 'Meeting Room', capacity: 6, location: 'Downtown Office', amenities: 'Whiteboard, WiFi, AC', status: 'active', floor_no: 1, room_number: 'A101', availability: 'available' },
    { catalog_id: 'CAT-02', room_id: 'R-04', room_name: 'Quick Meet 2', room_type: 'Meeting Room', capacity: 6, location: 'Business District', amenities: 'Projector, Whiteboard, WiFi, AC', status: 'active', floor_no: 1, room_number: 'A102', availability: 'available' },
    { catalog_id: 'CAT-03', room_id: 'R-05', room_name: 'Training Center', room_type: 'Training Room', capacity: 40, location: 'Tech Park Campus', amenities: 'Projector, WiFi, AC, Audio System, Whiteboard', status: 'active', floor_no: 3, room_number: 'C301', availability: 'available' },
    { catalog_id: 'CAT-03', room_id: 'R-06', room_name: 'Grand Auditorium', room_type: 'Auditorium', capacity: 50, location: 'Business District', amenities: 'Video Conferencing, WiFi, AC, Audio System, Projector', status: 'active', floor_no: 6, room_number: 'B601', availability: 'available' }
];

const bookings = [
    { booking_id: 'B-01', catalog_id: 'CAT-01', room_id: 'R-01', uid: 'U-02', start_date: '2026-02-20', end_date: '2026-02-20', start_time: '09:00:00', end_time: '11:00:00', purpose: 'Q1 Strategy Meeting', status: 'confirmed' },
    { booking_id: 'B-02', catalog_id: 'CAT-01', room_id: 'R-02', uid: 'U-03', start_date: '2026-02-20', end_date: '2026-02-20', start_time: '13:00:00', end_time: '14:30:00', purpose: 'Marketing Campaign Review', status: 'confirmed' },
    { booking_id: 'B-03', catalog_id: 'CAT-02', room_id: 'R-03', uid: 'U-04', start_date: '2026-02-21', end_date: '2026-02-21', start_time: '10:00:00', end_time: '11:00:00', purpose: 'HR Policy Discussion', status: 'confirmed' },
    { booking_id: 'B-04', catalog_id: 'CAT-02', room_id: 'R-04', uid: 'U-05', start_date: '2026-02-21', end_date: '2026-02-21', start_time: '14:00:00', end_time: '16:00:00', purpose: 'Budget Planning', status: 'confirmed' },
    { booking_id: 'B-05', catalog_id: 'CAT-03', room_id: 'R-05', uid: 'U-02', start_date: '2026-02-24', end_date: '2026-02-24', start_time: '09:00:00', end_time: '17:00:00', purpose: 'New Employee Training', status: 'confirmed' },
    { booking_id: 'B-06', catalog_id: 'CAT-03', room_id: 'R-06', uid: 'U-03', start_date: '2026-02-25', end_date: '2026-02-25', start_time: '11:00:00', end_time: '12:30:00', purpose: 'Client Presentation', status: 'pending' }
];

const cancellations = [
    { cancel_id: 'C-01', booking_id: 'B-04', cancel_reason: 'Schedule conflict with town hall meeting', cancel_date: '2026-02-20', cancel_fromdate: '2026-02-21', cancel_todate: '2026-02-21', cancel_fromtime: '14:00:00', cancel_totime: '16:00:00', cancelled_by_uid: 'U-05' }
];

const seedDB = async () => {
    try {
        await connectDB();
        console.log('Clearing existing data...');
        await User.deleteMany({});
        await Room.deleteMany({});
        await Booking.deleteMany({});
        await Cancellation.deleteMany({});

        console.log('Inserting seed data...');
        await User.insertMany(users);
        await Room.insertMany(rooms);
        await Booking.insertMany(bookings);
        await Cancellation.insertMany(cancellations);

        console.log('✅ DB successfully seeded with MongoDB data!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to seed database:', error);
        process.exit(1);
    }
};

seedDB();
