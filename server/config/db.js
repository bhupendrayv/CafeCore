const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // User should fill this in .env
};

let pool;

const initializeDB = async () => {
    try {
        // First connection without database to create it if it doesn't exist
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL service...');

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'cafe_db'}`);
        console.log('Database initialized...');
        await connection.end();

        // Now create a pool with the database specified
        pool = mysql.createPool({
            ...dbConfig,
            database: process.env.DB_NAME || 'cafe_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Create tables
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await pool.query(createTableQuery);
        console.log('Users table checked/created successfully.');

    } catch (error) {
        console.error('Database Initialization Error:', error.message);
        process.exit(1);
    }
};

const getPool = () => pool;

module.exports = { initializeDB, getPool };
