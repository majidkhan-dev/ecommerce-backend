const express = require('express');
const bcrypt = require('bcrypt');
const { authenticateToken, checkRole } = require('../middleware/auth');  // Middleware
const { getAllProducts } = require('../dboperations/users');
const { getAdminByEmail, updateAdminPassword, createSubAdmin, deleteSubAdmin, getAdminByID, updateProfile, getAllAdmins, getColors, getSizes, getGenders, addColor, addSize, addGender, checkIfColorExists, checkIfSizeExists, checkIfGenderExists, updateColor, updateSize, updateGender, deleteGender, deleteSize, deleteColor, getAllUsers, deleteUser, addProductWithAttributes, addProductAttribute, editProductWithAttributes, deleteProductWithAttributes, updateProductAttribute, getProductAttributesByProductID, deleteProductAttribute, getAllOrders, getUserOrders, getOrderDetails, updateOrderStatus, updatePaymentStatus } = require('../dboperations/admins'); // Admin functions for password recovery
const { sendPasswordResetCode } = require('../utils/emailService'); // Utility to send email (or SMS) with reset code
const crypto = require('crypto'); // For generating unique token for password reset
const router = express.Router();

// In-memory store for reset codes
const resetCodeStore = {};  // Key: admin's email, Value: { resetCode, expiryTime }
const RESET_CODE_EXPIRY_TIME = 10 * 60 * 1000;  // 10 minutes expiry time for reset codes

// SubAdmin creation logic
router.post('/create-subadmin', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        // Hash the password before passing it to the createSubAdmin function
        const hashedPassword = await bcrypt.hash(password, 10);  // Hash password with salt rounds

        // Create the new SubAdmin with the hashed password
        const newSubAdmin = await createSubAdmin({
            Name: name, 
            Email: email, 
            PasswordHash: hashedPassword,  // Pass the hashed password
            CreatedBy: req.user.id
        });

        return res.status(201).json({ message: 'SubAdmin created successfully', subadmin: newSubAdmin });
    } catch (error) {
        console.error('Error creating sub-admin:', error);
        res.status(500).json({ message: 'Error creating sub-admin', error: error.message });
    }
});

// Password recovery endpoint
router.post('/password-recovery', async (req, res) => { 
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // Fetch the admin or subadmin by email
        let user = await getAdminByEmail(email); // Fetch admin/subadmin by email
        if (!user) {
            return res.status(404).json({ message: 'Admin/Subadmin not found with this email.' });
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

        // Fetch the admin/subadmin from the Admin table using email
        const admin = await getAdminByEmail(email);

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        // Hash the new password before updating
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password using the AdminID from the Admin table
        await updateAdminPassword(admin.AdminID, hashedPassword);

        // Successfully reset the password
        delete resetCodeStore[email];  // Remove the reset code from memory after successful reset

        res.status(200).json({ message: 'Password successfully reset for admin/subadmin.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
});

// Delete SubAdmin route
router.delete('/delete-subadmin/:adminID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        const { adminID } = req.params;  // Get adminID from URL parameter

        // Ensure that the admin to be deleted is not the one making the request
        if (req.user.id === parseInt(adminID)) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        // Fetch the admin making the request by their own adminID
        const requestingAdmin = await getAdminByID(req.user.id);  // Use admin ID of the requester
        if (!requestingAdmin) {
            return res.status(404).json({ message: 'Admin making the request not found.' });
        }

        // Fetch the sub-admin to be deleted by adminID
        const subAdmin = await getAdminByID(adminID);  // Use the adminID passed in the URL to fetch the sub-admin
        if (!subAdmin) {
            return res.status(404).json({ message: 'SubAdmin not found.' });
        }

        // Ensure the account to be deleted is a sub-admin (not the main admin)
        if (subAdmin.Role !== 'Sub-Admin') {
            return res.status(400).json({ message: 'You can only delete sub-admins.' });
        }

        // Call the deleteAdmin function to delete the sub-admin
        const isDeleted = await deleteSubAdmin(adminID, requestingAdmin.Role);

        if (isDeleted) {
            return res.status(200).json({ message: 'SubAdmin deleted successfully.' });
        } else {
            return res.status(404).json({ message: 'SubAdmin not found.' });
        }
    } catch (error) {
        console.error('Error deleting sub-admin:', error);
        res.status(500).json({ message: 'Error deleting sub-admin', error: error.message });
    }
});

router.patch('/update-profile', authenticateToken, async (req, res) => {
    try {
        const { name, email, password } = req.body;  // Extract name, email, and password from request body
        const userId = req.user.id;  // Get the user ID from the token

        // Validate that at least one field is being provided for update
        if (!name && !email && !password) {
            return res.status(400).json({ message: 'Please provide at least one field to update (name, email, or password).' });
        }

        // Call the function to update the profile
        const isUpdated = await updateProfile(userId, { name, email, password });

        if (isUpdated) {
            return res.status(200).json({ message: 'Profile updated successfully.' });
        } else {
            return res.status(404).json({ message: 'Admin not found or no changes made.' });
        }

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile.', error: error.message });
    }
});

// Get all admins (including sub-admins) from the Admin table, only accessible by admin
router.get('/all-admins', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        // Call the function to get all admins from the database
        const admins = await getAllAdmins();

        // Return the list of admins
        return res.status(200).json({ admins });
    } catch (error) {
        console.error('Error fetching admins:', error);
        return res.status(500).json({ message: 'Error fetching admins', error: error.message });
    }
});

// Route to get all colors in ascending order by ColorID
router.get('/colors', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        // Fetch all colors from the Colors table, sorted by ColorID in ascending order
        const colors = await getColors();
        return res.status(200).json({ colors });
    } catch (error) {
        console.error('Error fetching colors:', error);
        res.status(500).json({ message: 'Error fetching colors', error: error.message });
    }
});

// Route to get all sizes in ascending order by SizeID
router.get('/sizes', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        // Fetch all sizes from the Sizes table, sorted by SizeID in ascending order
        const sizes = await getSizes();
        return res.status(200).json({ sizes });
    } catch (error) {
        console.error('Error fetching sizes:', error);
        res.status(500).json({ message: 'Error fetching sizes', error: error.message });
    }
});

// Route to get all genders in ascending order by GenderID
router.get('/genders', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        // Fetch all genders from the Gender table, sorted by GenderID in ascending order
        const genders = await getGenders();
        return res.status(200).json({ genders });
    } catch (error) {
        console.error('Error fetching genders:', error);
        res.status(500).json({ message: 'Error fetching genders', error: error.message });
    }
});

// Route to add a new color (ColorName should be passed in the request body)
router.post('/colors', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        const { ColorName } = req.body;  // Extract ColorName from the request body

        if (!ColorName) {
            return res.status(400).json({ message: 'ColorName is required.' });
        }

        // Check if the color already exists
        const colorExists = await checkIfColorExists(ColorName);
        if (colorExists) {
            return res.status(400).json({ message: 'Color already exists.' });
        }

        // Add the new color
        const newColor = await addColor(ColorName);
        return res.status(201).json({ message: 'Color added successfully.', color: newColor });
    } catch (error) {
        console.error('Error adding color:', error);
        res.status(500).json({ message: 'Error adding color', error: error.message });
    }
});

// Route to add a new size (SizeName should be passed in the request body)
router.post('/sizes', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        const { SizeName } = req.body;  // Extract SizeName from the request body

        if (!SizeName) {
            return res.status(400).json({ message: 'SizeName is required.' });
        }

        // Check if the size already exists
        const sizeExists = await checkIfSizeExists(SizeName);
        if (sizeExists) {
            return res.status(400).json({ message: 'Size already exists.' });
        }

        // Add the new size
        const newSize = await addSize(SizeName);
        return res.status(201).json({ message: 'Size added successfully.', size: newSize });
    } catch (error) {
        console.error('Error adding size:', error);
        res.status(500).json({ message: 'Error adding size', error: error.message });
    }
});

// Route to add a new gender (GenderName should be passed in the request body)
router.post('/genders', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        const { GenderName } = req.body;  // Extract GenderName from the request body

        if (!GenderName) {
            return res.status(400).json({ message: 'GenderName is required.' });
        }

        // Check if the gender already exists
        const genderExists = await checkIfGenderExists(GenderName);
        if (genderExists) {
            return res.status(400).json({ message: 'Gender already exists.' });
        }

        // Add the new gender
        const newGender = await addGender(GenderName);
        return res.status(201).json({ message: 'Gender added successfully.', gender: newGender });
    } catch (error) {
        console.error('Error adding gender:', error);
        res.status(500).json({ message: 'Error adding gender', error: error.message });
    }
});

// Route to edit color
router.put('/edit-color/:colorID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    const { colorID } = req.params;  // Get colorID from URL parameter
    const { colorName } = req.body;  // Get the new color name from the request body

    if (!colorName) {
        return res.status(400).json({ message: 'Color name is required.' });
    }

    try {
        // Check if the color already exists with the new name
        const colorExists = await checkIfColorExists(colorName);
        if (colorExists) {
            return res.status(400).json({ message: 'This color already exists.' });
        }

        // Update the color with the new value
        const isUpdated = await updateColor(colorID, colorName);
        if (isUpdated) {
            return res.status(200).json({ message: 'Color updated successfully.' });
        } else {
            return res.status(404).json({ message: 'Color not found.' });
        }
    } catch (error) {
        console.error('Error updating color:', error);
        return res.status(500).json({ message: 'Error updating color', error: error.message });
    }
});

// Route to edit size
router.put('/edit-size/:sizeID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    const { sizeID } = req.params;  // Get sizeID from URL parameter
    const { sizeName } = req.body;  // Get the new size name from the request body

    if (!sizeName) {
        return res.status(400).json({ message: 'Size name is required.' });
    }

    try {
        // Check if the size already exists with the new name
        const sizeExists = await checkIfSizeExists(sizeName);
        if (sizeExists) {
            return res.status(400).json({ message: 'This size already exists.' });
        }

        // Update the size with the new value
        const isUpdated = await updateSize(sizeID, sizeName);
        if (isUpdated) {
            return res.status(200).json({ message: 'Size updated successfully.' });
        } else {
            return res.status(404).json({ message: 'Size not found.' });
        }
    } catch (error) {
        console.error('Error updating size:', error);
        return res.status(500).json({ message: 'Error updating size', error: error.message });
    }
});

// Route to edit gender
router.put('/edit-gender/:genderID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    const { genderID } = req.params;  // Get genderID from URL parameter
    const { genderName } = req.body;  // Get the new gender name from the request body

    if (!genderName) {
        return res.status(400).json({ message: 'Gender name is required.' });
    }

    try {
        // Check if the gender already exists with the new name
        const genderExists = await checkIfGenderExists(genderName);
        if (genderExists) {
            return res.status(400).json({ message: 'This gender already exists.' });
        }

        // Update the gender with the new value
        const isUpdated = await updateGender(genderID, genderName);
        if (isUpdated) {
            return res.status(200).json({ message: 'Gender updated successfully.' });
        } else {
            return res.status(404).json({ message: 'Gender not found.' });
        }
    } catch (error) {
        console.error('Error updating gender:', error);
        return res.status(500).json({ message: 'Error updating gender', error: error.message });
    }
});

// Endpoint to delete Gender (accessible by Admin only)
router.delete('/delete-gender/:genderID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        const { genderID } = req.params;

        // Delete the gender
        await deleteGender(genderID);

        return res.status(200).json({ message: 'Gender deleted successfully.' });
    } catch (error) {
        console.error('Error deleting gender:', error);
        return res.status(500).json({ message: 'Error deleting gender', error: error.message });
    }
});

// Endpoint to delete Size (accessible by Admin only)
router.delete('/delete-size/:sizeID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        const { sizeID } = req.params;

        // Delete the size
        await deleteSize(sizeID);

        return res.status(200).json({ message: 'Size deleted successfully.' });
    } catch (error) {
        console.error('Error deleting size:', error);
        return res.status(500).json({ message: 'Error deleting size', error: error.message });
    }
});

// Endpoint to delete Color (accessible by Admin only)
router.delete('/delete-color/:colorID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        const { colorID } = req.params;

        // Delete the color
        await deleteColor(colorID);

        return res.status(200).json({ message: 'Color deleted successfully.' });
    } catch (error) {
        console.error('Error deleting color:', error);
        return res.status(500).json({ message: 'Error deleting color', error: error.message });
    }
});

// Route to view all users (Admins and Sub-Admins)
router.get('/view-users', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        // Fetch all users
        const users = await getAllUsers();

        if (users.length === 0) {
            return res.status(404).json({ message: 'No users found.' });
        }

        // Debugging: Log the users before sending the response
        console.log('Users to return:', users);

        return res.status(200).json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

// Route to delete a user (Admin only)
router.delete('/delete-user/:userID', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
        const { userID } = req.params;  // Get the UserID from URL parameters

        // Delete the user from the database
        const rowsAffected = await deleteUser(userID);

        if (rowsAffected === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
}); 

// Route to view all products (Accessible by Admins, Sub-Admins, and Users)
router.get('/view-products', authenticateToken, async (req, res) => {
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

// Route to add a new product along with its attributes (Only Admin and Sub-Admin)
router.post('/add-product', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { name, description, basePrice, colorID, sizeID, genderID, stock, price } = req.body;

    // Validate the input
    if (!name || !description || !basePrice || !colorID || !sizeID || !genderID || price === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const result = await addProductWithAttributes(name, description, basePrice, colorID, sizeID, genderID, stock, price);
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error adding product:', error);
        return res.status(500).json({ message: 'Error adding product', error: error.message });
    }
});

// Route to add a new product attribute for an existing product (Only Admin and Sub-Admin)
router.post('/add-product-attribute', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { productID, colorID, sizeID, genderID, stock, price } = req.body;

    // Validate the input
    if (!productID || !colorID || !sizeID || !genderID || stock === undefined || price === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const result = await addProductAttribute(productID, colorID, sizeID, genderID, stock, price);
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error adding product attribute:', error);
        return res.status(500).json({ message: 'Error adding product attribute', error: error.message });
    }
});

// Route to edit an existing product (Only Admin and Sub-Admin)
router.patch('/edit-product/:productID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { productID } = req.params;  // Product ID from the URL
    const { name, description, basePrice } = req.body;

    // Check if any field is provided to update
    try {
        const result = await editProductWithAttributes(productID, name, description, basePrice);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error editing product:', error);
        return res.status(500).json({ message: 'Error editing product', error: error.message });
    }
});
// Route to delete an existing product (Only Admin and Sub-Admin)
router.delete('/delete-product/:productID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { productID } = req.params;  // Product ID from the URL

    try {
        const result = await deleteProductWithAttributes(productID);

        if (!result) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
});

// Route to update an existing product attribute (Only Admin and Sub-Admin)
router.patch('/edit-product-attribute/:productAttributeID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { productAttributeID } = req.params;  // Get ProductAttributeID from the URL
    const { colorID, sizeID, genderID, stock, price } = req.body;

    // Validate the input (you can make fields optional depending on your logic)
    if (colorID === undefined && sizeID === undefined && genderID === undefined && stock === undefined && price === undefined) {
        return res.status(400).json({ message: 'No fields provided to update.' });
    }

    try {
        const result = await updateProductAttribute(productAttributeID, colorID, sizeID, genderID, stock, price);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error editing product attribute:', error);
        return res.status(500).json({ message: 'Error editing product attribute', error: error.message });
    }
});

// Route to get product attributes by ProductID (Only Admin and Sub-Admin)
router.get('/product-attributes/:productID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { productID } = req.params;  // Get ProductID from the URL

    try {
        const productAttributes = await getProductAttributesByProductID(productID);
        return res.status(200).json({ productAttributes });
    } catch (error) {
        console.error('Error fetching product attributes:', error);
        return res.status(500).json({ message: 'Error fetching product attributes', error: error.message });
    }
});

// Route to delete a product attribute (Only Admin and Sub-Admin)
router.delete('/delete-product-attribute/:productAttributeID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { productAttributeID } = req.params;  // Get ProductAttributeID from the URL

    try {
        const result = await deleteProductAttribute(productAttributeID);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting product attribute:', error);
        return res.status(500).json({ message: 'Error deleting product attribute', error: error.message });
    }
});

// Route to view all orders (Only Admin and Sub-Admin)
router.get('/view-orders', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    try {
        const orders = await getAllOrders();
        return res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// Route to get orders of a specific user (accessible by Admin and Sub-Admin)
router.get('/user-orders/:userID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const userID = req.params.userID;  // Get the userID from the URL parameters

    try {
        const orders = await getUserOrders(userID);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user' });
        }
        return res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

router.get('/order-details/:orderID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const orderID = req.params.orderID;  // Get the orderID from the URL parameter

    try {
        const orderDetails = await getOrderDetails(orderID);
        if (orderDetails.length === 0) {
            return res.status(404).json({ message: 'Order details not found' });
        }
        return res.status(200).json({ orderDetails });
    } catch (error) {
        console.error('Error fetching order details:', error);
        return res.status(500).json({ message: 'Error fetching order details', error: error.message });
    }
});

router.put('/update-order-status/:orderID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { orderID } = req.params; // Get the orderID from the URL
    const { newStatus } = req.body; // Get the new order status from the body
    const adminID = req.user.id; // Get the admin/subadmin ID from the token

    // Validate the new status
    const validStatuses = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: 'Invalid status. Allowed values are: Pending, Dispatched, Delivered, Cancelled.' });
    }

    try {
        const result = await updateOrderStatus(orderID, newStatus, adminID); // Pass the adminID to the update function
        if (result) {
            return res.status(200).json({ message: `Order ${orderID} status updated to ${newStatus}` });
        } else {
            return res.status(404).json({ message: 'Order not found or status change failed' });
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
});

router.put('/update-payment-status/:orderID', authenticateToken, checkRole(['Admin', 'Sub-Admin']), async (req, res) => {
    const { orderID } = req.params; // Get the orderID from the URL
    const { newPaymentStatus } = req.body; // Get the new payment status from the body
    const adminID = req.user.id; // Get the admin/subadmin ID from the token

    // Validate the payment status
    const validPaymentStatuses = ['Paid', 'Unpaid'];
    if (!validPaymentStatuses.includes(newPaymentStatus)) {
        return res.status(400).json({ message: 'Invalid payment status. Allowed values are: Paid, Unpaid.' });
    }

    try {
        const result = await updatePaymentStatus(orderID, newPaymentStatus, adminID); // Pass adminID to the update function
        if (result) {
            return res.status(200).json({ message: `Order ${orderID} payment status updated to ${newPaymentStatus}` });
        } else {
            return res.status(404).json({ message: 'Order not found or status change failed' });
        }
    } catch (error) {
        console.error('Error updating payment status:', error);
        return res.status(500).json({ message: 'Error updating payment status', error: error.message });
    }
});

module.exports = router;
