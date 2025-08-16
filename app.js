const express = require('express');
const dotenv = require('dotenv');
const authRouter = require('./routes/auth');  // Import the auth routes
const usersRouter = require('./routes/users');  // Import the users routes
const adminsRouter = require('./routes/admins');  // Import the admin routes
require('./dboperations/backgroundTasks');

dotenv.config();

const app = express();

// Middleware to parse incoming requests
app.use(express.json());  // To handle JSON request bodies

// Mount the auth routes
app.use('/auth', authRouter); // For admin login and user login

// Mount the users routes
app.use('/users', usersRouter); // For user signup and profile

// Mount the admin routes
app.use('/admins', adminsRouter); // For admin and subadmin related actions

// Define a port and start the server
const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});