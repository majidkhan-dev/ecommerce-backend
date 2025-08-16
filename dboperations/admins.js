const poolPromise = require('../config/dbconfig'); 
const sql = require('mssql');

// Function to get Admin by email
const getAdminByEmail = async (email) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT AdminID, Name, Email, PasswordHash, Role, CreatedBy, CreatedAt FROM Admin WHERE Email = @Email');

        return result.recordset[0]; // Return the Admin record if found
    } catch (error) {
        console.error('Error fetching admin/sub-admin by email:', error);
        throw error;
    }
};

// Function to create a new SubAdmin
const createSubAdmin = async ({ Name, Email, PasswordHash, CreatedBy }) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Name', sql.NVarChar, Name)
            .input('Email', sql.NVarChar, Email)
            .input('PasswordHash', sql.NVarChar, PasswordHash)
            .input('Role', sql.NVarChar, 'Sub-Admin')  // Ensure the role is always 'Sub-Admin'
            .input('CreatedBy', sql.Int, CreatedBy) // The Admin ID creating this sub-admin
            .input('CreatedAt', sql.DateTime, new Date()) // Set the creation date
            .query(`
                INSERT INTO Admin (Name, Email, PasswordHash, Role, CreatedBy, CreatedAt)
                VALUES (@Name, @Email, @PasswordHash, @Role, @CreatedBy, @CreatedAt);
                SELECT SCOPE_IDENTITY() AS AdminID;
            `);

        return result.recordset[0]; // Return the newly created SubAdmin's ID
    } catch (error) {
        console.error('Error creating sub-admin:', error);
        throw error;
    }
};

// Update admin password in Admins table
const updateAdminPassword = async (adminID, newPassword) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('AdminID', sql.Int, adminID)  // Use AdminID here
            .input('PasswordHash', sql.NVarChar, newPassword)
            .query('UPDATE Admin SET PasswordHash = @PasswordHash WHERE AdminID = @AdminID'); // Update password using AdminID

        return result.rowsAffected[0] > 0; // Return true if the password was updated
    } catch (error) {
        console.error('Error updating admin password:', error);
        throw error;
    }
};

// Function to delete a Sub-Admin by AdminID
const deleteSubAdmin = async (subAdminID, requestingAdminRole) => {
    try {
        // Ensure the requester has the 'Admin' role
        if (requestingAdminRole !== 'Admin') {
            throw new Error('Only admins can delete sub-admin accounts.');
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('AdminID', sql.Int, subAdminID)
            .query('DELETE FROM Admin WHERE AdminID = @AdminID AND Role = \'Sub-Admin\''); // Only delete if the role is Sub-Admin

        return result.rowsAffected[0] > 0; // Return true if the deletion was successful
    } catch (error) {
        console.error('Error deleting sub-admin:', error);
        throw error;
    }
};

// In your dboperations/admins.js
const getAdminByID = async (adminID) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('AdminID', sql.Int, adminID)
        .query('SELECT * FROM Admin WHERE AdminID = @AdminID');

    return result.recordset[0];  // Assuming this returns the admin object
};

const updateProfile = async (userId, { name, email, password }) => {
    try {
      const pool = await poolPromise;
      
      let query = 'UPDATE Admin SET';
      let params = [];
      
      // Conditionally add fields to be updated based on what is provided
      if (name) {
        query += ` Name = @Name,`;
        params.push({ name: 'Name', value: name });
      }
  
      if (email) {
        query += ` Email = @Email,`;
        params.push({ name: 'Email', value: email });
      }
  
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ` PasswordHash = @PasswordHash,`;
        params.push({ name: 'PasswordHash', value: hashedPassword });
      }
  
      // Remove the trailing comma if no fields were added
      if (query.endsWith(',')) {
        query = query.slice(0, -1);  // Remove last comma
      }
  
      query += ' WHERE AdminID = @AdminID';
      
      // Ensure AdminID is passed as an integer
      params.push({ name: 'AdminID', value: parseInt(userId, 10) });
  
      const result = await pool.request();
      
      // Add the parameters to the query
      params.forEach(param => {
        if (param.name === 'AdminID') {
          result.input(param.name, sql.Int, param.value);  // Use sql.Int for AdminID
        } else {
          result.input(param.name, sql.VarChar, param.value);  // Default to sql.VarChar for strings
        }
      });
  
      const updateResult = await result.query(query);
  
      return updateResult.rowsAffected[0] > 0; // Return true if update was successful
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
};  

// Function to get all admins from the Admin table
const getAllAdmins = async () => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT AdminID, Name, Email, Role FROM Admin'); // Get basic information (AdminID, Name, Email, Role)
        return result.recordset;  // Return the result as an array of records
    } catch (error) {
        console.error('Error fetching admins:', error);
        throw error;
    }
};

// Get all colors in ascending order by ColorID
const getColors = async () => {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT * FROM Colors ORDER BY ColorID ASC');
    return result.recordset; // Return the result as an array of colors
};

// Get all sizes in ascending order by SizeID
const getSizes = async () => {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT * FROM Sizes ORDER BY SizeID ASC');
    return result.recordset; // Return the result as an array of sizes
};

// Get all genders in ascending order by GenderID
const getGenders = async () => {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT * FROM Gender ORDER BY GenderID ASC');
    return result.recordset; // Return the result as an array of genders
};

// Check if a color already exists
const checkIfColorExists = async (ColorName) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('ColorName', sql.VarChar(100), ColorName)  // Input the ColorName
        .query('SELECT COUNT(*) AS count FROM Colors WHERE ColorName = @ColorName');

    return result.recordset[0].count > 0; // Return true if the color exists
};

// Check if a size already exists
const checkIfSizeExists = async (SizeName) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('SizeName', sql.VarChar(100), SizeName)  // Input the SizeName
        .query('SELECT COUNT(*) AS count FROM Sizes WHERE SizeName = @SizeName');

    return result.recordset[0].count > 0; // Return true if the size exists
};

// Check if a gender already exists
const checkIfGenderExists = async (GenderName) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('GenderName', sql.VarChar(100), GenderName)  // Input the GenderName
        .query('SELECT COUNT(*) AS count FROM Gender WHERE GenderName = @GenderName');

    return result.recordset[0].count > 0; // Return true if the gender exists
};

// Function to add a new color
const addColor = async (ColorName) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('ColorName', sql.VarChar(100), ColorName)  // Input the ColorName
        .query('INSERT INTO Colors (ColorName) VALUES (@ColorName); SELECT * FROM Colors WHERE ColorID = SCOPE_IDENTITY();');

    return result.recordset[0]; // Return the newly added color record
};

// Function to add a new size
const addSize = async (SizeName) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('SizeName', sql.VarChar(100), SizeName)  // Input the SizeName
        .query('INSERT INTO Sizes (SizeName) VALUES (@SizeName); SELECT * FROM Sizes WHERE SizeID = SCOPE_IDENTITY();');

    return result.recordset[0]; // Return the newly added size record
};

// Function to add a new gender
const addGender = async (GenderName) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('GenderName', sql.VarChar(100), GenderName)  // Input the GenderName
        .query('INSERT INTO Gender (GenderName) VALUES (@GenderName); SELECT * FROM Gender WHERE GenderID = SCOPE_IDENTITY();');

    return result.recordset[0]; // Return the newly added gender record
};

// Function to update color
const updateColor = async (colorID, colorName) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ColorID', sql.Int, colorID)
            .input('ColorName', sql.NVarChar, colorName)
            .query('UPDATE Colors SET ColorName = @ColorName WHERE ColorID = @ColorID');
        return result.rowsAffected[0] > 0;  // Returns true if update is successful
    } catch (error) {
        console.error('Error updating color:', error);
        throw error;
    }
};

// Function to update size
const updateSize = async (sizeID, sizeName) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('SizeID', sql.Int, sizeID)
            .input('SizeName', sql.NVarChar, sizeName)
            .query('UPDATE Sizes SET SizeName = @SizeName WHERE SizeID = @SizeID');
        return result.rowsAffected[0] > 0;  // Returns true if update is successful
    } catch (error) {
        console.error('Error updating size:', error);
        throw error;
    }
};

// Function to update gender
const updateGender = async (genderID, genderName) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('GenderID', sql.Int, genderID)
            .input('GenderName', sql.NVarChar, genderName)
            .query('UPDATE Gender SET GenderName = @GenderName WHERE GenderID = @GenderID');
        return result.rowsAffected[0] > 0;  // Returns true if update is successful
    } catch (error) {
        console.error('Error updating gender:', error);
        throw error;
    }
};

// Delete Gender by GenderID (only for admins)
const deleteGender = async (genderID) => {
    const pool = await poolPromise;

    // Check if the gender exists
    const genderExists = await pool.request()
        .input('GenderID', sql.Int, genderID)
        .query('SELECT COUNT(*) AS count FROM Gender WHERE GenderID = @GenderID');

    if (genderExists.recordset[0].count === 0) {
        throw new Error('Gender not found.');
    }

    // Proceed to delete the gender
    await pool.request()
        .input('GenderID', sql.Int, genderID)
        .query('DELETE FROM Gender WHERE GenderID = @GenderID');
};

// Delete Size by SizeID (only for admins)
const deleteSize = async (sizeID) => {
    const pool = await poolPromise;

    // Check if the size exists
    const sizeExists = await pool.request()
        .input('SizeID', sql.Int, sizeID)
        .query('SELECT COUNT(*) AS count FROM Sizes WHERE SizeID = @SizeID');

    if (sizeExists.recordset[0].count === 0) {
        throw new Error('Size not found.');
    }

    // Proceed to delete the size
    await pool.request()
        .input('SizeID', sql.Int, sizeID)
        .query('DELETE FROM Sizes WHERE SizeID = @SizeID');
};

// Delete Color by ColorID (only for admins)
const deleteColor = async (colorID) => {
    const pool = await poolPromise;

    // Check if the color exists
    const colorExists = await pool.request()
        .input('ColorID', sql.Int, colorID)
        .query('SELECT COUNT(*) AS count FROM Colors WHERE ColorID = @ColorID');

    if (colorExists.recordset[0].count === 0) {
        throw new Error('Color not found.');
    }

    // Proceed to delete the color
    await pool.request()
        .input('ColorID', sql.Int, colorID)
        .query('DELETE FROM Colors WHERE ColorID = @ColorID');
};

// Function to get all users (Admin and Sub-Admin) from Users table
const getAllUsers = async () => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT UserID, Name, Email, Phone, CreatedAt FROM Users ORDER BY UserID ASC');
        
        console.log('Fetched users from database:', result.recordset); // Debugging
        return result.recordset; // Return all users as an array
    } catch (error) {
        console.error('Error fetching users from database:', error);
        throw error; // Propagate error to be handled in the route
    }
};

// Function to delete a user by UserID
const deleteUser = async (userID) => {
    try {
        const pool = await poolPromise;
        // Start a transaction to ensure atomicity (delete from Users and Addresses)
        const transaction = pool.transaction();
        await transaction.begin();

        // Delete from Addresses table first (because of foreign key constraint)
        await transaction.request()
            .input('UserID', sql.Int, userID)
            .query('DELETE FROM Addresses WHERE UserID = @UserID');

        // Then delete from Users table
        const result = await transaction.request()
            .input('UserID', sql.Int, userID)
            .query('DELETE FROM Users WHERE UserID = @UserID');

        await transaction.commit();  // Commit the transaction

        return result.rowsAffected;  // Return the number of rows affected
    } catch (error) {
        console.error('Error deleting user from database:', error);
        throw error;  // Propagate error to be handled in the route
    }
};

// Function to add a new product and insert its attributes
const addProductWithAttributes = async (name, description, basePrice, colorID, sizeID, genderID, stock, price) => {
    try {
        const pool = await poolPromise;

        // Step 1: Insert into Products Table
        const insertProductQuery = `
            INSERT INTO Products (Name, Description, BasePrice)
            OUTPUT INSERTED.ProductID
            VALUES (@Name, @Description, @BasePrice)`;

        const result = await pool.request()
            .input('Name', sql.NVarChar, name)
            .input('Description', sql.NVarChar, description)
            .input('BasePrice', sql.Decimal, basePrice)
            .query(insertProductQuery);

        const productID = result.recordset[0].ProductID; // Get the newly created ProductID

        // Step 2: Insert into ProductAttributes Table (first attribute for the new product)
        const insertProductAttributeQuery = `
            INSERT INTO ProductAttributes (ProductID, ColorID, SizeID, GenderID, Stock, Price)
            VALUES (@ProductID, @ColorID, @SizeID, @GenderID, @Stock, @Price)`;

        await pool.request()
            .input('ProductID', sql.Int, productID)
            .input('ColorID', sql.Int, colorID)
            .input('SizeID', sql.Int, sizeID)
            .input('GenderID', sql.Int, genderID)
            .input('Stock', sql.Int, stock)
            .input('Price', sql.Decimal, price)
            .query(insertProductAttributeQuery);

        return { productID, message: 'Product and ProductAttribute created successfully' };

    } catch (error) {
        console.error('Error adding product and attributes:', error);
        throw error;
    }
};

// dboperations/admins.js
const addProductAttribute = async (productID, colorID, sizeID, genderID, stock, price) => {
    try {
        const pool = await poolPromise;

        // Step 1: Check if the product exists
        const checkProductQuery = `
            SELECT ProductID FROM Products WHERE ProductID = @ProductID`;

        const productResult = await pool.request()
            .input('ProductID', sql.Int, productID)
            .query(checkProductQuery);

        if (productResult.recordset.length === 0) {
            throw new Error('Product not found');
        }

        // Step 2: Insert into ProductAttributes Table for the new variation
        const insertProductAttributeQuery = `
            INSERT INTO ProductAttributes (ProductID, ColorID, SizeID, GenderID, Stock, Price)
            VALUES (@ProductID, @ColorID, @SizeID, @GenderID, @Stock, @Price)`;

        await pool.request()
            .input('ProductID', sql.Int, productID)
            .input('ColorID', sql.Int, colorID)
            .input('SizeID', sql.Int, sizeID)
            .input('GenderID', sql.Int, genderID)
            .input('Stock', sql.Int, stock)
            .input('Price', sql.Decimal, price)
            .query(insertProductAttributeQuery);

        return { message: 'Product attribute created successfully' };

    } catch (error) {
        console.error('Error adding product attribute:', error);
        throw error;
    }
};

// Function to edit product details (only update provided fields)
const editProductWithAttributes = async (productID, name, description, basePrice) => {
    try {
        const pool = await poolPromise;

        // Dynamically build the SET clause for the product update query
        let updateFields = [];
        let request = pool.request(); // Create a new request object for query parameters

        // Check and add the name to the update query if provided
        if (name && name.trim() !== '') {
            updateFields.push('Name = @Name');
            request.input('Name', sql.NVarChar, name);
        }

        // Check and add the description to the update query if provided
        if (description && description.trim() !== '') {
            updateFields.push('Description = @Description');
            request.input('Description', sql.NVarChar, description);
        }

        // Check and add the basePrice to the update query if provided
        if (basePrice !== undefined) {
            updateFields.push('BasePrice = @BasePrice');
            request.input('BasePrice', sql.Decimal, basePrice);
        }

        // If no valid fields are provided, return a message
        if (updateFields.length === 0) {
            return { message: 'No fields to update' };  // No valid fields to update
        }

        // Construct the final UPDATE query
        const updateProductQuery = `
            UPDATE Products
            SET ${updateFields.join(', ')}
            WHERE ProductID = @ProductID`;

        // Add the productID parameter to the list
        request.input('ProductID', sql.Int, productID);

        // Execute the query to update the product
        await request.query(updateProductQuery);

        return { message: 'Product updated successfully' };

    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
};

// Function to delete product and its attributes by ProductID
const deleteProductWithAttributes = async (productID) => {
    try {
        const pool = await poolPromise;

        // Step 1: Delete Product from ProductAttributes Table
        const deleteProductAttributesQuery = `
            DELETE FROM ProductAttributes
            WHERE ProductID = @ProductID`;

        await pool.request()
            .input('ProductID', sql.Int, productID)
            .query(deleteProductAttributesQuery);

        // Step 2: Delete Product from Products Table
        const deleteProductQuery = `
            DELETE FROM Products
            WHERE ProductID = @ProductID`;

        const result = await pool.request()
            .input('ProductID', sql.Int, productID)
            .query(deleteProductQuery);

        if (result.rowsAffected[0] === 0) {
            return null; // If no rows were affected, it means the product wasn't found
        }

        return true;

    } catch (error) {
        console.error('Error deleting product and attributes:', error);
        throw error;
    }
};

// Function to update product attribute in the ProductAttributes table
const updateProductAttribute = async (productAttributeID, colorID, sizeID, genderID, stock, price) => {
    try {
        const pool = await poolPromise;

        // Dynamically build the update query
        let updateQuery = `UPDATE ProductAttributes SET `;
        let parameters = [];
        let values = [];

        if (colorID) {
            updateQuery += `ColorID = @ColorID, `;
            parameters.push({ name: 'ColorID', value: colorID });
        }

        if (sizeID) {
            updateQuery += `SizeID = @SizeID, `;
            parameters.push({ name: 'SizeID', value: sizeID });
        }

        if (genderID) {
            updateQuery += `GenderID = @GenderID, `;
            parameters.push({ name: 'GenderID', value: genderID });
        }

        if (stock !== undefined) {
            updateQuery += `Stock = @Stock, `;
            parameters.push({ name: 'Stock', value: stock });
        }

        if (price !== undefined) {
            updateQuery += `Price = @Price, `;
            parameters.push({ name: 'Price', value: price });
        }

        // Remove the trailing comma
        updateQuery = updateQuery.slice(0, -2);

        // Add WHERE clause to update only the specific ProductAttributeID
        updateQuery += ` WHERE ProductAttributeID = @ProductAttributeID`;

        // Set the parameters for the query
        const request = pool.request();
        request.input('ProductAttributeID', sql.Int, productAttributeID);
        
        parameters.forEach(param => {
            request.input(param.name, sql.Int, param.value); // You can adjust the type (sql.Int, sql.Decimal, etc.) based on the field
        });

        // Execute the update query
        await request.query(updateQuery);

        return { message: 'Product attribute updated successfully' };
    } catch (error) {
        console.error('Error updating product attribute:', error);
        throw error;
    }
};

// Function to get product attributes by ProductID
const getProductAttributesByProductID = async (productID) => {
    try {
        const pool = await poolPromise;

        // Query to fetch product attributes along with related color, size, and gender
        const query = `
            SELECT 
                pa.ProductAttributeID,
                pa.ProductID,
                c.ColorName AS Color,
                s.SizeName AS Size,
                g.GenderName AS Gender,
                pa.Stock,
                pa.Price
            FROM ProductAttributes pa
            JOIN Colors c ON pa.ColorID = c.ColorID
            JOIN Sizes s ON pa.SizeID = s.SizeID
            JOIN Gender g ON pa.GenderID = g.GenderID
            WHERE pa.ProductID = @ProductID`;

        const result = await pool.request()
            .input('ProductID', sql.Int, productID)
            .query(query);

        if (result.recordset.length === 0) {
            throw new Error('No product attributes found for this product');
        }

        return result.recordset;
    } catch (error) {
        console.error('Error fetching product attributes:', error);
        throw error;
    }
};

// Function to delete product attribute by ProductAttributeID
const deleteProductAttribute = async (productAttributeID) => {
    try {
        const pool = await poolPromise;

        // Query to delete the product attribute record
        const deleteQuery = `
            DELETE FROM ProductAttributes
            WHERE ProductAttributeID = @ProductAttributeID`;

        const result = await pool.request()
            .input('ProductAttributeID', sql.Int, productAttributeID)
            .query(deleteQuery);

        // Check if any row was deleted
        if (result.rowsAffected[0] === 0) {
            throw new Error('Product attribute not found or already deleted');
        }

        return { message: 'Product attribute deleted successfully' };
    } catch (error) {
        console.error('Error deleting product attribute:', error);
        throw error;
    }
};

// Function to retrieve all orders
const getAllOrders = async () => {
    try {
        const pool = await poolPromise;

        // Query to get all orders
        const query = `
            SELECT 
                OrderID, 
                UserID, 
                OrderTime, 
                Status, 
                PaymentStatus, 
                TotalAmount, 
                DispatchedBy
            FROM Orders
            ORDER BY OrderTime DESC;`;

        const result = await pool.request().query(query);
        
        return result.recordset;  // Return all the orders
    } catch (error) {
        console.error('Error retrieving orders:', error);
        throw error;
    }
};

const getUserOrders = async (userID) => {
    try {
        const pool = await poolPromise;

        // Query to fetch orders for the specified user
        const result = await pool.request()
            .input('UserID', sql.Int, userID)
            .query(`
                SELECT o.OrderID, o.OrderTime, o.Status, o.PaymentStatus, o.TotalAmount
                FROM Orders o
                WHERE o.UserID = @UserID
                ORDER BY o.OrderTime DESC;
            `);

        // Return the fetched orders
        return result.recordset;
    } catch (error) {
        throw new Error(`Error fetching orders: ${error.message}`);
    }
};

const getOrderDetails = async (orderID) => {
    try {
        const pool = await poolPromise;  // Get database connection

        const result = await pool.request()
            .input('OrderID', sql.Int, orderID)
            .query(`
                SELECT 
                    od.OrderDetailID,
                    od.Quantity,
                    od.Subtotal,
                    pa.ProductAttributeID,
                    c.ColorName,
                    s.SizeName,
                    g.GenderName,
                    p.Name AS ProductName
                FROM 
                    OrderDetails od
                INNER JOIN 
                    ProductAttributes pa ON od.ProductAttributeID = pa.ProductAttributeID
                INNER JOIN 
                    Colors c ON pa.ColorID = c.ColorID
                INNER JOIN 
                    Sizes s ON pa.SizeID = s.SizeID
                INNER JOIN 
                    Gender g ON pa.GenderID = g.GenderID
                INNER JOIN 
                    Products p ON pa.ProductID = p.ProductID
                WHERE 
                    od.OrderID = @OrderID;
            `);

        return result.recordset;  // Return the result from the query
    } catch (error) {
        throw new Error(`Error fetching order details: ${error.message}`);
    }
};


const updateOrderStatus = async (orderID, newStatus, adminID) => {
    try {
        const pool = await poolPromise;

        // Check if the order exists
        const orderCheck = await pool.request()
            .input('OrderID', sql.Int, orderID)
            .query('SELECT * FROM Orders WHERE OrderID = @OrderID');

        if (orderCheck.recordset.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderCheck.recordset[0];

        // Prevent changing the status or payment status of a cancelled order
        if (order.Status === 'Cancelled') {
            throw new Error('Cancelled orders cannot have their status changed');
        }

        // Check if the new status is valid
        const validStatuses = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error('Invalid status');
        }

        // Check if the new status is allowed based on the current status
        // Prevent going from Dispatched to Pending, for example
        if (order.Status === 'Dispatched' && newStatus === 'Pending') {
            throw new Error('Order cannot go back to Pending after being Dispatched');
        }

        // If the new status is 'Cancelled', restock the items
        if (newStatus === 'Cancelled') {
            const orderDetails = await pool.request()
                .input('OrderID', sql.Int, orderID)
                .query('SELECT * FROM OrderDetails WHERE OrderID = @OrderID');

            for (let detail of orderDetails.recordset) {
                // Restock the items by adding the quantity back to the stock
                await pool.request()
                    .input('ProductAttributeID', sql.Int, detail.ProductAttributeID)
                    .input('Quantity', sql.Int, detail.Quantity)
                    .query(`
                        UPDATE ProductAttributes
                        SET Stock = Stock + @Quantity
                        WHERE ProductAttributeID = @ProductAttributeID
                    `);
            }
        }

        // Update the status of the order and set the UpdatedBy field (adminID)
        const result = await pool.request()
            .input('OrderID', sql.Int, orderID)
            .input('Status', sql.NVarChar, newStatus)
            .input('UpdatedBy', sql.Int, adminID)  // Store the admin/subadmin ID
            .query(`
                UPDATE Orders 
                SET Status = @Status
                WHERE OrderID = @OrderID
            `);

        // If the update is successful, return true
        if (result.rowsAffected[0] > 0) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        throw new Error(`Error updating order status: ${error.message}`);
    }
};

const updatePaymentStatus = async (orderID, newPaymentStatus, adminID) => {
    try {
        const pool = await poolPromise;

        // Check if the order exists
        const orderCheck = await pool.request()
            .input('OrderID', sql.Int, orderID)
            .query('SELECT * FROM Orders WHERE OrderID = @OrderID');

        if (orderCheck.recordset.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderCheck.recordset[0];

        // Check if the order is cancelled
        if (order.Status === 'Cancelled' && newPaymentStatus === 'Paid') {
            throw new Error('Cancelled orders cannot be set to "Paid"');
        }

        // Check if the new payment status is valid
        const validPaymentStatuses = ['Paid', 'Unpaid'];
        if (!validPaymentStatuses.includes(newPaymentStatus)) {
            throw new Error('Invalid payment status');
        }

        // Update the payment status of the order and set the UpdatedBy field (adminID)
        const result = await pool.request()
            .input('OrderID', sql.Int, orderID)
            .input('PaymentStatus', sql.NVarChar, newPaymentStatus)
            .input('UpdatedBy', sql.Int, adminID)  // Store the admin/subadmin ID
            .query(`
                UPDATE Orders 
                SET PaymentStatus = @PaymentStatus, UpdatedBy = @UpdatedBy 
                WHERE OrderID = @OrderID
            `);

        // If the update is successful, return true
        if (result.rowsAffected[0] > 0) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        throw new Error(`Error updating payment status: ${error.message}`);
    }
};

module.exports = { getAdminByEmail, createSubAdmin, updateAdminPassword, deleteSubAdmin, getAdminByID, updateProfile, getAllAdmins, getColors, getSizes, getGenders, addColor, addSize, addGender, checkIfColorExists, checkIfSizeExists, checkIfGenderExists, updateColor, updateSize, updateGender, deleteGender, deleteSize, deleteColor, getAllUsers, deleteUser, addProductWithAttributes, addProductAttribute, editProductWithAttributes, deleteProductWithAttributes, updateProductAttribute, getProductAttributesByProductID, deleteProductAttribute, getAllOrders, getUserOrders, getOrderDetails, updateOrderStatus, updatePaymentStatus };