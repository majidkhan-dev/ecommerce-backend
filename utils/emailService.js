const nodemailer = require('nodemailer');

// Function to send password reset code via email
const sendPasswordResetCode = async (email, resetCode) => {
    try {
        // Set up email transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL, // Email ID from .env file
                pass: process.env.EMAIL_PASSWORD // App password from .env file
            }
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${resetCode}. Use this to reset your password.`
        };

        // Send the email
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};

module.exports = { sendPasswordResetCode };
