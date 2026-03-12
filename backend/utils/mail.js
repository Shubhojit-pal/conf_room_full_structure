const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    console.log('[MAIL] Initializing transporter with:', process.env.EMAIL_USER);
    transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    transporter.verify(function (error, success) {
        if (error) {
            console.error('[MAIL] SMTP verification failed:', error);
        } else {
            console.log('[MAIL] SMTP server is ready');
        }
    });

    return transporter;
};

/**
 * Send an OTP to a user's email
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {string} type - 'registration' or 'reset'
 */
const sendOtpEmail = async (toEmail, otp, type = 'registration') => {
    console.log(`[MAIL] Attempting to send ${type} OTP to: ${toEmail}`);
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('[MAIL] ERROR: EMAIL_USER or EMAIL_PASS not set in environment.');
        return false;
    }

    const currentTransporter = getTransporter();
    
    const subject = type === 'registration' 
        ? 'Verify Your Account - Conference Room Booking' 
        : 'Password Reset OTP - Conference Room Booking';
    
    const message = type === 'registration'
        ? `Your verification code is: ${otp}. This code will expire in 10 minutes.`
        : `Your password reset code is: ${otp}. This code will expire in 10 minutes.`;

    const mailOptions = {
        from: `"Conference Room Booking" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: subject,
        text: message,
        html: `
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
        `
    };

    try {
        console.log(`[MAIL] Transporter ready: ${currentTransporter.options.service}`);
        const info = await currentTransporter.sendMail(mailOptions);
        console.log(`[MAIL] Success! MessageID: ${info.messageId}`);
        console.log(`[MAIL] Response: ${info.response}`);
        return true;
    } catch (error) {
        console.error('[MAIL] CRITICAL ERROR during sendMail:', error);
        console.error('[MAIL] Error code:', error.code);
        console.error('[MAIL] SMTP Response:', error.response);
        return false;
    }
};

/**
 * Send a booking notification email
 * @param {string} toEmail 
 * @param {Object} bookingDetails 
 * @param {string} type - 'created', 'confirmed', 'rejected', 'cancelled'
 */
const sendBookingEmail = async (toEmail, bookingDetails, type = 'confirmed') => {
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

    const mailOptions = {
        from: `"Conference Room Booking" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: subject,
        html: `
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
        `
    };

    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log(`\n[MAIL] SMTP not configured. Booking ${type} email for ${toEmail}`);
            return true;
        }
        await transporter.sendMail(mailOptions);
        console.log(`[MAIL] Booking ${type} email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('[MAIL] Error sending booking email:', error);
        return false;
    }
};

module.exports = { sendOtpEmail, sendBookingEmail };
