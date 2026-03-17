const nodemailer = require('nodemailer');
require('dotenv').config();

// Initialize the SMTP transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
    },
    // Force IPv4
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
});

const fromEmail = process.env.EMAIL_USER;

/**
 * Send an OTP to a user's email
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {string} type - 'registration' or 'reset'
 */
const sendOtpEmail = async (toEmail, otp, type = 'registration') => {
    console.log(`[MAIL] Attempting to send ${type} OTP to: ${toEmail} via SMTP (${process.env.EMAIL_SERVICE})`);
    
    const subject = type === 'registration' 
        ? 'Verify Your Account - Conference Room Booking' 
        : 'Password Reset OTP - Conference Room Booking';
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #0d9488;">Conference Room Booking</h2>
            <p>Hello,</p>
            <p>${type === 'registration' ? 'Thank you for registering. Please use the following code to verify your account:' : 'You requested a password reset. Please use the following code to reset your password:'}</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otp}</span>
            </div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">This is an automated message, please do not reply.</p>
        </div>
    `;

    const mailOptions = {
        from: `"Conference Room Booking" <${fromEmail}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MAIL] Success! MessageID: ${info.messageId}`);
        return { success: true };
    } catch (error) {
        console.error('[MAIL] SMTP Error (OTP):', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send a booking notification email
 * @param {string} toEmail 
 * @param {Object} bookingDetails 
 * @param {string} type - 'created', 'confirmed', 'rejected', 'cancelled'
 */
const sendBookingEmail = async (toEmail, bookingDetails, type = 'confirmed') => {
    console.log(`[MAIL] Attempting to send Booking ${type} notification to: ${toEmail} via SMTP (${process.env.EMAIL_SERVICE})`);

    let subject = '';
    let title = '';
    let color = '#0d9488';

    switch (type) {
        case 'created':
            subject = 'Booking Request Received - Conference Room Booking';
            title = 'Booking Request Received';
            break;
        case 'confirmed':
            subject = 'Booking Confirmed! - Conference Room Booking';
            title = 'Booking Confirmed';
            break;
        case 'rejected':
            subject = 'Booking Rejected - Conference Room Booking';
            title = 'Booking Rejected';
            color = '#e11d48';
            break;
        case 'cancelled':
            subject = 'Booking Cancelled - Conference Room Booking';
            title = 'Booking Cancelled';
            color = '#64748b';
            break;
    }

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: ${color};">${title}</h2>
            <p>Hello,</p>
            <p>There has been an update to your booking:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Room:</strong> ${bookingDetails.room_name}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDetails.date}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${bookingDetails.start_time} - ${bookingDetails.end_time}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">${type.toUpperCase()}</span></p>
            </div>
            <p>You can view more details in your dashboard.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">This is an automated message, please do not reply.</p>
        </div>
    `;

    const mailOptions = {
        from: `"Conference Room Booking" <${fromEmail}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MAIL] Booking ${type} email sent successfully! MessageID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[MAIL] SMTP Error (Booking):', error);
        return false;
    }
};

module.exports = { sendOtpEmail, sendBookingEmail };
