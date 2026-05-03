# E-Commerce Backend

A RESTful backend API for an e-commerce platform built with Node.js, Express.js, and MSSQL. Handles user authentication, product management, inventory, and order processing with full ACID-compliant transactions.

## Features

- User registration and authentication
- Product catalog management
- Inventory tracking
- Order creation and management
- ACID-compliant database transactions
- REST API tested with Postman

## Tech Stack

| Item | Detail |
|------|--------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MSSQL (Microsoft SQL Server) |
| API Testing | Postman |

## Getting Started

### Prerequisites
- Node.js installed
- Microsoft SQL Server installed and running
- Postman (for testing)

### Setup

1. Clone the repository
```bash
git clone https://github.com/majidkhan-dev/ecommerce-backend
cd ecommerce-backend
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root and add your database config
```
DB_SERVER=your_server_name
DB_DATABASE=your_database_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
PORT=3000
```

4. Run the server
```bash
npm start
```

## License

MIT — feel free to use, modify, and distribute.
