const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getAdminByEmail } = require('../dboperations/admins');  // To fetch admin by email
const { getUserByEmail, logLoginActivity, logLogoutActivity, checkExistingSession, updateSessionToLogout } = require('../dboperations/users');   // To fetch user by email
const { authenticateTokenUsers, authenticateToken } = require('../middleware/auth');
const router = express.Router();
const dotenv = require('dotenv');

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// Admin Login Route (checks against the Admin table)
router.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Fetch admin by email
        const admin = await getAdminByEmail(email);

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, admin.PasswordHash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: admin.AdminID, role: admin.Role },
            JWT_SECRET,
            { expiresIn: '2m' }
        );

        // Log the login activity
        await logLoginActivity({
            adminId: admin.AdminID,
            userId: null,
            ipAddress: req.ip || 'Unknown',
            deviceInfo: req.headers['user-agent'] || 'Unknown Device',
            status: 'Login'
        });

        res.json({
            message: 'Admin login successful',
            token
        });
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Error during login', error: error.message });
    }
});

// Admin logout route
router.post('/admin-logout', authenticateToken, async (req, res) => {
    try {
        const adminId = req.user?.id;

        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required.' });
        }

        // Call the logLogoutActivity function to update the status in the LoginHistory table
        await logLogoutActivity(null, adminId);

        res.json({ message: 'Admin logged out successfully.' });
    } catch (error) {
        console.error('Error during admin logout:', error);
        res.status(500).json({ message: 'Error during logout', error: error.message });
    }
});

// User Login Route (checks against the Users table)
router.post('/user-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Fetch user by email
        const user = await getUserByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.UserID, role: 'User' },
            JWT_SECRET,
            { expiresIn: '2m' }
        );

        // Log the login activity
        await logLoginActivity({
            adminId: null,
            userId: user.UserID,
            ipAddress: req.ip || 'Unknown',
            deviceInfo: req.headers['user-agent'] || 'Unknown Device',
            status: 'Login'
        });

        res.json({
            message: 'User login successful',
            token
        });
    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ message: 'Error during login', error: error.message });
    }
});

// User logout route
router.post('/user-logout', authenticateTokenUsers, async (req, res) => {
    try {
        // The user ID is available in req.user after successful authentication
        const { id: userId } = req.user;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        // Call the logLogoutActivity function to update the status in the LoginHistory table
        await logLogoutActivity(userId, null);  // No admin ID, so passing null

        res.json({ message: 'User logged out successfully.' });
    } catch (error) {
        console.error('Error during user logout:', error);
        res.status(500).json({ message: 'Error during logout', error: error.message });
    }
});

module.exports = router;