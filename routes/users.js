const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { createUser, getUserByPhone, getUserByEmail, getAllProducts, getProductById, storeResetCode, verifyResetCode, updateUserPassword, updateUserInfo, deleteUserById, placeOrder, getUserOrders, getFilteredProducts } = require('../dboperations/users');
const { sendPasswordResetCode } = require('../utils/emailService'); // Utility to send email (or SMS) with reset code
const router = express.Router();
const { authenticateTokenUsers } = require('../middleware/auth');
// In-memory store for reset codes
const resetCodeStore = {};  // Key: user email, Value: { resetCode, expiryTime }
const RESET_CODE_EXPIRY_TIME = 10 * 60 * 1000;  // 10 minutes expiry time for reset codes

// User Signup Route (unchanged)
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if all required fields are provided
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: 'Name, email, password, and phone are required.' });
        }

        // Check if the email already exists
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user
        const newUser = await createUser({
            Name: name,
            Email: email,
            PasswordHash: hashedPassword,
            Phone: phone,
        });

        // Send a response with the newly created user info (without password)
        res.status(201).json({
            message: 'User created successfully',
            userId: newUser.UserID,
            name: newUser.Name,
            email: newUser.Email,
            phone: newUser.Phone,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
});

// User Password Recovery Route (phone number verification)
router.post('/password-recovery', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // Fetch the user by email
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: 'User not found with this email.' });
        }

        // Generate a temporary password reset code (or token)
        const resetCode = crypto.randomBytes(20).toString('hex'); // Random token

        // Store the reset code in memory with an expiry time
        resetCodeStore[email] = {
            resetCode,
            expiryTime: Date.now() + RESET_CODE_EXPIRY_TIME  // Expiry time 10 minutes from now
        };

        // Send the reset code to the user's email (or phone)
        await sendPasswordResetCode(user.Email, resetCode);  // Using email service

        res.status(200).json({ message: 'Password reset code sent to registered email.' });

    } catch (error) {
        console.error('Error during password recovery:', error);
        res.status(500).json({ message: 'Error during password recovery', error: error.message });
    }
});

// User Password Reset Route (after receiving reset code)
router.post('/reset-password', async (req, res) => {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
        return res.status(400).json({ message: 'Email, reset code, and new password are required.' });
    }

    try {
        // Check if the reset code exists and is not expired
        const storedResetCode = resetCodeStore[email];

        if (!storedResetCode) {
            return res.status(400).json({ message: 'Invalid reset code.' });
        }

        if (Date.now() > storedResetCode.expiryTime) {
            // If the reset code has expired
            delete resetCodeStore[email];  // Remove expired code from the store
            return res.status(400).json({ message: 'Reset code has expired.' });
        }

        if (storedResetCode.resetCode !== resetCode) {
            return res.status(400).json({ message: 'Invalid reset code.' });
        }

        // Fetch the user from the database using email
        const user = await getUserByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Hash the new password before updating
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password using the UserID from the User table
        await updateUserPassword(user.UserID, hashedPassword);

        // Successfully reset the password
        delete resetCodeStore[email];  // Remove the reset code from memory after successful reset

        res.status(200).json({ message: 'Password successfully reset for user.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
});

// Route to view all products (Accessible by Admins, Sub-Admins, and Users)
router.get('/view-products', authenticateTokenUsers, async (req, res) => {
    try {
        const userRole = req.user.role;  // Get the role from the authenticated user (Admin, Sub-Admin, or User)

        // Fetch the products based on the user's role
        const products = await getAllProducts(userRole);

        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found.' });
        }

        // Return the products list
        return res.status(200).json({ products });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
}); 

// Route to get details of a single product by ProductID
router.get('/view-product/:productID', authenticateTokenUsers, async (req, res) => {
    const { productID } = req.params;  // Get ProductID from route parameter

    if (!productID) {
        return res.status(400).json({ message: 'Product ID is required.' });
    }

    try {
        const result = await getProductById(productID);
        
        if (!result) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching product details:', error);
        return res.status(500).json({ message: 'Error fetching product details', error: error.message });
    }
});

// Route to update user account information (PATCH)
router.patch('/update-account', authenticateTokenUsers, async (req, res) => {
    const updates = req.body;  // Fields to update
    const userID = req.user?.id; // Use the userID from the token (now it's `req.user.id`)

    if (!userID) {
        return res.status(401).json({ message: 'UserID missing in token payload' });
    }

    try {
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No fields provided to update.' });
        }

        const result = await updateUserInfo(userID, updates);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating account information:', error);
        res.status(500).json({
            message: 'Error updating account information',
            error: error.message,
        });
    }
});

// Route to delete user account (DELETE)
router.delete('/delete-account', authenticateTokenUsers, async (req, res) => {
    const userID = req.user?.id; // Get the userID from the authenticated token

    if (!userID) {
        return res.status(401).json({ message: 'UserID missing in token payload' });
    }

    try {
        // Delete the user from the database
        const result = await deleteUserById(userID);

        if (!result) {
            return res.status(404).json({ message: 'User not found or account already deleted.' });
        }

        // Return success response
        res.status(200).json({ message: 'User account deleted successfully.' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ message: 'Error deleting account', error: error.message });
    }
});

// routes/orders.js
router.post('/place-order', authenticateTokenUsers, async (req, res) => {
    const userID = req.user?.id;
    console.log("UserID in route handler:", userID); // Debug

    if (!userID) {
        return res.status(400).json({ message: 'UserID is missing' });
    }

    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items in the cart' });
    }

    try {
        const result = await placeOrder(userID, items);
        res.status(201).json({ message: 'Order placed successfully', orderID: result.orderID });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ message: 'Error placing order', error: error.message });
    }
});

// Route to view all orders for the user (GET)
router.get('/orders', authenticateTokenUsers, async (req, res) => {
    try {
        const userID = req.user.id; // Extract UserID from the token
        console.log('UserID from token in /orders route:', userID); // Debug UserID
        const result = await getUserOrders(userID);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        return res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// Route to fetch products based on filters
router.get('/view-products/filter', authenticateTokenUsers, async (req, res) => {
    const { size, color, gender, priceFrom, priceTo } = req.query;

    try {
        // Call the function to get filtered products from the database
        const products = await getFilteredProducts(size, color, gender, priceFrom, priceTo);
        
        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found matching the filters' });
        }
        
        return res.status(200).json({ products });
    } catch (error) {
        console.error('Error fetching filtered products:', error);
        return res.status(500).json({ message: 'Error fetching filtered products', error: error.message });
    }
});

module.exports = router;