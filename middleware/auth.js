// middleware/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate the token
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Extract token from Authorization header

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Store the user info in the request object
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

const authenticateTokenUsers = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'User' && decoded.id) {
            req.user = { id: decoded.id, role: decoded.role };
            next();
        } else {
            res.status(400).json({ message: 'Invalid token payload for User' });
        }
    } catch (error) {
        console.error('JWT Verification Error:', error);
        res.status(400).json({ message: 'Invalid token for User' });
    }
};

// Middleware to check if the user has the correct role (Admin or SubAdmin)
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden. You do not have the necessary role.' });
        }
        next();
    };
};

function isLoggedIn(req, res, next) {
    const user = req.user; // Assume req.user is populated by your authentication middleware
    if (!user) {
        return res.status(401).json({ message: 'You must be logged in to access this resource' });
    }
    next();
}

module.exports = { authenticateToken, checkRole, isLoggedIn, authenticateTokenUsers };
