const { Resend } = require('resend');
require('dotenv').config();

// The user provided the API key: re_578xCXA8_3NgNov4L7WxujKqusbDRmgPU
// It's strongly recommended to put this in your .env file as RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY || 're_578xCXA8_3NgNov4L7WxujKqusbDRmgPU');

// Resend allows sending from onboarding@resend.dev for testing purposes,
// but it will ONLY deliver to the email address you registered your Resend account with.
// Once you verify a domain in Resend, you can change this to bookings@yourdomain.com via the EMAIL_FROM env variable.
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

/**
 * Send an OTP to a user's email
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {string} type - 'registration' or 'reset'
 */
const sendOtpEmail = async (toEmail, otp, type = 'registration') => {
    console.log(`[MAIL] Attempting to send ${type} OTP to: ${toEmail} via Resend`);
    
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

    try {
        const { data, error } = await resend.emails.send({
            from: `"Conference Room Booking" <${fromEmail}>`,
            to: [toEmail],
            subject: subject,
            html: htmlContent
        });

        if (error) {
            console.error('[MAIL] Resend API Error (OTP):', error);
            return { success: false, error: error.message };
        }

        console.log(`[MAIL] Success! MessageID: ${data.id}`);
        return { success: true };
    } catch (error) {
        console.error('[MAIL] CRITICAL ERROR sending OTP email:', error);
        return { success: false, error: error.message || 'Unknown API error' };
    }
};

/**
 * Send a booking notification email
 * @param {string} toEmail 
 * @param {Object} bookingDetails 
 * @param {string} type - 'created', 'confirmed', 'rejected', 'cancelled'
 */
const sendBookingEmail = async (toEmail, bookingDetails, type = 'confirmed') => {
    console.log(`[MAIL] Attempting to send Booking ${type} notification to: ${toEmail} via Resend`);

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

    try {
        const { data, error } = await resend.emails.send({
            from: `"Conference Room Booking" <${fromEmail}>`,
            to: [toEmail],
            subject: subject,
            html: htmlContent
        });

        if (error) {
            console.error('[MAIL] Resend API Error (Booking):', error);
            return false;
        }

        console.log(`[MAIL] Booking ${type} email sent successfully! MessageID: ${data.id}`);
        return true;
    } catch (error) {
        console.error('[MAIL] CRITICAL ERROR sending booking email:', error);
        return false;
    }
};

module.exports = { sendOtpEmail, sendBookingEmail };
