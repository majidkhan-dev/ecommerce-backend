const cron = require('node-cron');
const poolPromise = require('../config/dbconfig'); // Import your DB connection pool

// SQL query to mark expired sessions as 'Logout'
const autoLogoutExpiredSessions = async () => {
    try {
        const pool = await poolPromise;
        // Query to update sessions older than 50 seconds to 'Logout'
        const result = await pool.request()
            .query(`
                UPDATE LoginHistory
                SET Status = 'Logout', LogoutTime = GETDATE()
                WHERE Status = 'Login'
                    AND LoginTime < DATEADD(SECOND, -50, GETDATE())  -- Adjusting to 50 seconds
                    AND LogoutTime IS NULL;
            `);

    } catch (error) {
        console.error('Error during auto logout:', error);
    }
};

// Schedule the task to run every minute (adjust as needed)
cron.schedule('* * * * *', () => {
    autoLogoutExpiredSessions(); // Run the function to check and logout expired sessions
});
