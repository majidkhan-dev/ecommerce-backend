const sql = require('mssql');
const dotenv = require('dotenv');

// Load environment variables from the .env file
dotenv.config();

// Set up the database connection pool using values from .env file
const config = {
    user: process.env.DB_USER,         // Database username from .env
    password: process.env.DB_PASSWORD, // Database password from .env
    server: process.env.DB_SERVER,     // Database server from .env
    database: process.env.DB_NAME,     // Database name from .env
    options: {
        encrypt: true,                 // Use encryption for the connection if needed
        trustServerCertificate: true,  // Set to true if using self-signed certificates
    },
};

// Create and export the pool for query execution
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to MSSQL database');
        return pool;
    })
    .catch(err => {
        console.error('Database connection failed:', err);
        process.exit(1); // Exit if the connection fails
    });

module.exports = poolPromise;