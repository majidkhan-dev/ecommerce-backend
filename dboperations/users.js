const poolPromise = require('../config/dbconfig'); 
const sql = require('mssql');
const bcrypt = require('bcrypt');

// Function to get User by email
const getUserByEmail = async (email) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE Email = @Email');

        return result.recordset[0]; // Return the first matching user (if found)
    } catch (error) {
        console.error('Error fetching user by email:', error);
        throw error;
    }
};

// Function to create a new User and hash the password
const createUser = async (userData) => {
    try {
        const pool = await poolPromise;  // Get the database pool connection
        const { Name, Email, PasswordHash, Phone } = userData;

        // Insert the new user into the Users table (do not pass UserID as it will be auto-generated)
        const result = await pool.request()
            .input('Name', sql.NVarChar, Name)
            .input('Email', sql.NVarChar, Email)
            .input('PasswordHash', sql.NVarChar, PasswordHash)
            .input('Phone', sql.NVarChar, Phone)
            .query(`
                INSERT INTO Users (Name, Email, PasswordHash, Phone)
                VALUES (@Name, @Email, @PasswordHash, @Phone);
                SELECT SCOPE_IDENTITY() AS UserID;
            `);

        // Extract the UserID from the result
        const userID = result.recordset[0].UserID;

        // Return the user object with UserID
        return { UserID: userID, Name, Email, Phone };
    } catch (error) {
        console.error('Error creating user:', error);  // Log the error for debugging
        throw new Error('Error creating user');
    }
};

// Function to get user by phone number (Users table)
const getUserByPhone = async (phone) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Phone', sql.NVarChar, phone)
            .query('SELECT * FROM Users WHERE Phone = @Phone'); // Users table for user data

        return result.recordset[0]; // Return user record if found
    } catch (error) {
        console.error('Error fetching user by phone:', error);
        throw error;
    }
};

// Store reset code in Users table
const storeResetCode = async (userID, resetCode) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userID)
            .input('ResetCode', sql.NVarChar, resetCode)
            .query('UPDATE Users SET ResetCode = @ResetCode WHERE UserID = @UserID');

        return result.rowsAffected[0] > 0; // Return true if the update was successful
    } catch (error) {
        console.error('Error storing reset code:', error);
        throw error;
    }
};

// Verify reset code in Users table
const verifyResetCode = async (resetCode) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ResetCode', sql.NVarChar, resetCode)
            .query('SELECT * FROM Users WHERE ResetCode = @ResetCode'); // Users table for reset code

        return result.recordset[0]; // Return the user if the reset code matches
    } catch (error) {
        console.error('Error verifying reset code:', error);
        throw error;
    }
};

// Update user password in Users table
const updateUserPassword = async (userID, newPassword) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userID)
            .input('PasswordHash', sql.NVarChar, newPassword)
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE UserID = @UserID');

        return result.rowsAffected[0] > 0; // Return true if the password was updated
    } catch (error) {
        console.error('Error updating user password:', error);
        throw error;
    }
};

// Function to get all products based on role (Accessible by Admins, Sub-Admins, and Users)
const getAllProducts = async (role) => {
    try {
        const pool = await poolPromise;

        let query = `
            SELECT p.ProductID, p.Name, p.Description, p.BasePrice, 
                   pa.Stock, pa.Price, c.ColorName, s.SizeName, g.GenderName
            FROM Products p
            LEFT JOIN ProductAttributes pa ON p.ProductID = pa.ProductID
            LEFT JOIN Colors c ON pa.ColorID = c.ColorID
            LEFT JOIN Sizes s ON pa.SizeID = s.SizeID
            LEFT JOIN Gender g ON pa.GenderID = g.GenderID
            ORDER BY p.ProductID ASC
        `;

        const result = await pool.request().query(query);
        const products = result.recordset;

        // Grouping products by ProductID and creating the structure
        const groupedProducts = {};

        products.forEach(product => {
            const { ProductID, Name, Description, BasePrice, Stock, Price, ColorName, SizeName, GenderName } = product;

            // Initialize the product object if not already in groupedProducts
            if (!groupedProducts[ProductID]) {
                groupedProducts[ProductID] = {
                    ProductID,
                    Name,
                    Description,
                    BasePrice,
                    variants: []
                };
            }

            // Add the variant (Color, Size, Gender) with Stock and Price
            groupedProducts[ProductID].variants.push({
                Color: ColorName,
                Size: SizeName,
                Gender: GenderName,
                Stock,
                Price
            });
        });

        // Convert the groupedProducts object to an array for returning
        return Object.values(groupedProducts);
    } catch (error) {
        console.error('Error fetching products from database:', error);
        throw error;
    }
};

const getProductById = async (productID) => {
    try {
        const pool = await poolPromise;
        let query = `
            SELECT p.ProductID, p.Name, p.Description, p.BasePrice, 
                   pa.Stock, pa.Price, c.ColorName, s.SizeName, g.GenderName
            FROM Products p
            LEFT JOIN ProductAttributes pa ON p.ProductID = pa.ProductID
            LEFT JOIN Colors c ON pa.ColorID = c.ColorID
            LEFT JOIN Sizes s ON pa.SizeID = s.SizeID
            LEFT JOIN Gender g ON pa.GenderID = g.GenderID
            WHERE p.ProductID = @productID
            ORDER BY pa.ProductAttributeID ASC
        `;

        const result = await pool.request()
            .input('productID', sql.Int, productID)  // Using parameterized query to avoid SQL injection
            .query(query);

        const product = result.recordset;

        if (product.length === 0) {
            return null;  // No product found with the given ProductID
        }

        // Grouping product details and variants
        const productDetails = {
            ProductID: product[0].ProductID,
            Name: product[0].Name,
            Description: product[0].Description,
            BasePrice: product[0].BasePrice,
            variants: []
        };

        // Loop through the result set and create the variants array
        product.forEach(item => {
            productDetails.variants.push({
                Color: item.ColorName,
                Size: item.SizeName,
                Gender: item.GenderName,
                Stock: item.Stock,
                Price: item.Price
            });
        });

        return productDetails;
    } catch (error) {
        console.error('Error fetching product from database:', error);
        throw error;  // Propagate error to be handled in the route
    }
};

const updateUserInfo = async (userID, updates) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();

        // Ensure userID is valid
        if (!userID) {
            throw new Error('UserID is required');
        }

        let updateFields = [];
        let updateValues = [];

        // Dynamically process the updates
        for (const [field, value] of Object.entries(updates)) {
            // If updating password, hash it before saving
            if (field === 'password') {
                const hashedPassword = await bcrypt.hash(value, 10);
                updateFields.push('PasswordHash');
                updateValues.push(hashedPassword);
            } else {
                updateFields.push(field.charAt(0).toUpperCase() + field.slice(1)); // Match database field names
                updateValues.push(value);
            }
        }

        // If no fields were provided, throw an error
        if (updateFields.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Build query dynamically
        let query = `UPDATE Users SET `;
        query += updateFields.map((field, index) => `${field} = @value${index}`).join(', ');
        query += ` WHERE UserID = @userID`;

        // Bind values
        updateValues.forEach((value, index) => {
            request.input(`value${index}`, sql.NVarChar, value);
        });

        request.input('userID', sql.Int, userID);

        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            throw new Error('User not found or no changes made');
        }

        return { message: 'Account information updated successfully' };
    } catch (error) {
        console.error('Error updating user account:', error);
        throw error;
    }
};

// Function to delete user by UserID
const deleteUserById = async (userID) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();

        // Execute the delete query
        const result = await request
            .input('userID', sql.Int, userID)
            .query('DELETE FROM Users WHERE UserID = @userID');

        // If no rows were affected, it means the user wasn't found
        if (result.rowsAffected[0] === 0) {
            return null;
        }

        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
};


const placeOrder = async (userID, items) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        // Start a transaction
        await transaction.begin();

        // Calculate the total amount and prepare the data
        let totalAmount = 0;
        const itemDetails = [];

        // Check stock availability before processing the order
        for (let item of items) {
            const productDetails = await transaction.request()
                .input('ProductAttributeID', sql.Int, item.ProductAttributeID)
                .query(`
                    SELECT Price, Stock FROM ProductAttributes WHERE ProductAttributeID = @ProductAttributeID
                `);

            if (productDetails.recordset.length === 0) {
                throw new Error(`Product with ID ${item.ProductAttributeID} not found`);
            }

            const { Price, Stock } = productDetails.recordset[0];

            // Check if the requested quantity is more than the available stock
            if (item.quantity > Stock) {
                throw new Error(`Insufficient stock for Product with ID ${item.ProductAttributeID}`);
            }

            const subtotal = Price * item.quantity;
            totalAmount += subtotal;

            itemDetails.push({ ...item, price: Price, subtotal });
        }

        // Insert into Orders table
        const orderResult = await transaction.request()
            .input('UserID', sql.Int, userID)
            .input('Status', sql.NVarChar, 'Pending')
            .input('PaymentStatus', sql.NVarChar, 'Unpaid')
            .input('TotalAmount', sql.Decimal(10, 2), totalAmount)
            .query(`
                INSERT INTO Orders (UserID, Status, PaymentStatus, TotalAmount)
                OUTPUT INSERTED.OrderID
                VALUES (@UserID, @Status, @PaymentStatus, @TotalAmount);
            `);

        const orderID = orderResult.recordset[0].OrderID;

        // Insert items into OrderDetails
        for (let detail of itemDetails) {
            await transaction.request()
                .input('OrderID', sql.Int, orderID)
                .input('ProductAttributeID', sql.Int, detail.ProductAttributeID)
                .input('Quantity', sql.Int, detail.quantity)
                .input('Subtotal', sql.Decimal(10, 2), detail.subtotal)
                .query(`
                    INSERT INTO OrderDetails (OrderID, ProductAttributeID, Quantity, Subtotal)
                    VALUES (@OrderID, @ProductAttributeID, @Quantity, @Subtotal);
                `);
        }

        // Update stock in ProductAttributes table after order is placed
        for (let item of items) {
            await transaction.request()
                .input('ProductAttributeID', sql.Int, item.ProductAttributeID)
                .input('Quantity', sql.Int, item.quantity)
                .query(`
                    UPDATE ProductAttributes
                    SET Stock = Stock - @Quantity
                    WHERE ProductAttributeID = @ProductAttributeID;
                `);
        }

        // Commit the transaction if everything is successful
        await transaction.commit();

        // Return the order ID
        return { orderID };
    } catch (error) {
        // Rollback the transaction in case of an error
        await transaction.rollback();
        throw new Error(`Error placing order: ${error.message}`);
    }
};

// Function to fetch all orders for a user
const getUserOrders = async (userID) => {
    try {
        console.log('Executing getUserOrders with UserID:', userID); // Debug UserID
        const pool = await poolPromise;

        const result = await pool.request()
            .input('UserID', sql.Int, userID)
            .query(`
                SELECT 
                    o.OrderID, 
                    o.OrderTime, 
                    o.Status, 
                    o.PaymentStatus, 
                    o.TotalAmount,
                    od.ProductAttributeID, 
                    od.Quantity, 
                    od.Subtotal,
                    pa.ColorID, 
                    pa.SizeID, 
                    pa.GenderID
                FROM Orders o
                INNER JOIN OrderDetails od ON o.OrderID = od.OrderID
                INNER JOIN ProductAttributes pa ON od.ProductAttributeID = pa.ProductAttributeID
                WHERE o.UserID = @UserID
                ORDER BY o.OrderTime DESC;
            `);

        if (result.recordset.length === 0) {
            console.log('No orders found in database for UserID:', userID); // Debug empty result
            return { message: 'No orders found for this user' };
        }

        console.log('Orders retrieved:', result.recordset); // Debug results
        return { message: 'Orders retrieved successfully', orders: result.recordset };
    } catch (error) {
        console.error('Error retrieving user orders:', error); // Debug error
        throw new Error('Error retrieving user orders');
    }
};

// Function to fetch filtered products
const getFilteredProducts = async (size, color, gender, priceFrom, priceTo) => {
    try {
        const pool = await poolPromise;

        // Create the request object after getting the pool
        const request = pool.request();

        // Start building the SQL query
        let query = `
            SELECT p.ProductID, p.Name AS ProductName, pa.Price, c.ColorName, s.SizeName, g.GenderName
            FROM Products p
            JOIN ProductAttributes pa ON p.ProductID = pa.ProductID
            JOIN Colors c ON pa.ColorID = c.ColorID
            JOIN Sizes s ON pa.SizeID = s.SizeID
            JOIN Gender g ON pa.GenderID = g.GenderID
            WHERE 1=1
        `;

        // Declare an array to hold parameter names dynamically
        let parameterCount = 0;

        // Add conditions based on the provided filters
        if (size) {
            const sizeArray = size.split(',').map(s => s.trim()); // Handle multiple sizes
            query += ` AND s.SizeName IN (${sizeArray.map(() => `@Size${parameterCount++}`).join(', ')})`;
            sizeArray.forEach((s, index) => request.input(`Size${index}`, sql.NVarChar, s));
        }

        if (color) {
            const colorArray = color.split(',').map(c => c.trim()); // Handle multiple colors
            query += ` AND c.ColorName IN (${colorArray.map(() => `@Color${parameterCount++}`).join(', ')})`;
            colorArray.forEach((c, index) => request.input(`Color${index}`, sql.NVarChar, c));
        }

        if (gender) {
            const genderArray = gender.split(',').map(g => g.trim()); // Handle multiple genders
            query += ` AND g.GenderName IN (${genderArray.map(() => `@Gender${parameterCount++}`).join(', ')})`;
            genderArray.forEach((g, index) => request.input(`Gender${index}`, sql.NVarChar, g));
        }

        if (priceFrom && priceTo) {
            query += ` AND pa.Price BETWEEN @PriceFrom AND @PriceTo`;
        } else if (priceFrom) {
            query += ` AND pa.Price >= @PriceFrom`;
        } else if (priceTo) {
            query += ` AND pa.Price <= @PriceTo`;
        }

        // Add price parameters
        if (priceFrom) request.input('PriceFrom', sql.Decimal(10, 2), priceFrom);
        if (priceTo) request.input('PriceTo', sql.Decimal(10, 2), priceTo);

        // Execute the query
        const result = await request.query(query);

        // If there are no results, return an empty array
        if (result.recordset.length === 0) {
            return []; // Return an empty array if no products match
        }

        // Return the results
        return result.recordset;
    } catch (error) {
        console.error('Error fetching filtered products:', error);
        throw new Error(`Error fetching products: ${error.message}`);
    }
};

// Function to handle logins (for both admins and users)
const logLoginActivity = async ({ userId, adminId, ipAddress, deviceInfo, status }) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, userId || null)
            .input('AdminID', sql.Int, adminId || null)
            .input('IPAddress', sql.NVarChar, ipAddress)
            .input('DeviceInfo', sql.NVarChar, deviceInfo)
            .input('Status', sql.NVarChar, status)
            .query(`
                INSERT INTO LoginHistory (UserID, AdminID, LoginTime, IPAddress, DeviceInfo, Status)
                VALUES (@UserID, @AdminID, GETDATE(), @IPAddress, @DeviceInfo, @Status)
            `);
    } catch (error) {
        console.error('Error logging login activity:', error);
        throw error;
    }
};

// Function to handle logouts for both admins and users
const logLogoutActivity = async (userId, adminId) => {
    try {
        const pool = await poolPromise;

        // Prepare the request
        const request = pool.request();
        request.input('UserID', sql.Int, userId || null);
        request.input('AdminID', sql.Int, adminId || null);

        // Update the status and logout time for the active session
        await request.query(`
            UPDATE LoginHistory
            SET Status = 'Logout', LogoutTime = GETDATE()
            WHERE (UserID = @UserID OR AdminID = @AdminID)
              AND Status = 'Login'
              AND LogoutTime IS NULL
        `);
    } catch (error) {
        console.error('Error logging logout activity:', error);
        throw error;
    }
};

// Service function to check existing session for admin or user
const checkExistingSession = async (adminId, ipAddress, deviceInfo) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('adminId', sql.Int, adminId)
            .input('ipAddress', sql.NVarChar, ipAddress)
            .input('deviceInfo', sql.NVarChar, deviceInfo)
            .query(`
                SELECT * FROM LoginHistory 
                WHERE (AdminID = @adminId OR UserID = @adminId) 
                AND IPAddress = @ipAddress 
                AND DeviceInfo = @deviceInfo 
                AND Status = 'Login'
            `);
        return result.recordset.length > 0; // Return whether session exists
    } catch (error) {
        console.error('Error checking existing session:', error);
        throw error;
    }
};

// Service function to update session status to 'Logout'
const updateSessionToLogout = async (ipAddress, deviceInfo) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ipAddress', sql.NVarChar, ipAddress)
            .input('deviceInfo', sql.NVarChar, deviceInfo)
            .query(`
                UPDATE LoginHistory 
                SET Status = 'Logout' 
                WHERE IPAddress = @ipAddress 
                AND DeviceInfo = @deviceInfo 
                AND Status = 'Login'
            `);
    } catch (error) {
        console.error('Error updating session to Logout:', error);
        throw error;
    }
};

module.exports = { getUserByEmail,createUser,getUserByPhone, storeResetCode, verifyResetCode, updateUserPassword, getAllProducts, getProductById, updateUserInfo, deleteUserById, placeOrder, getUserOrders, getFilteredProducts, logLoginActivity, logLogoutActivity, checkExistingSession, updateSessionToLogout };