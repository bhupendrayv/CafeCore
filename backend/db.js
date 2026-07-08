const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initDB() {
    try {
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
        };

        // Connect to MySQL and create DB if not exists
        const connection = await mysql.createConnection(dbConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'cafe_db'}`);
        await connection.end();

        // Create pool
        pool = mysql.createPool({
            ...dbConfig,
            database: process.env.DB_NAME || 'cafe_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Initialize Tables based on cafe_management_db.sql + Auth fields
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Staff (
                staff_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Customer (
                customer_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(15) UNIQUE NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Menu (
                item_id INT PRIMARY KEY AUTO_INCREMENT,
                item_name VARCHAR(100) UNIQUE NOT NULL,
                price DECIMAL(10, 2) NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Orders (
                order_id INT PRIMARY KEY AUTO_INCREMENT,
                customer_id INT NOT NULL,
                order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'Pending',
                delivered_at DATETIME NULL,
                FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE
            )
        `);

        // Safe migration for existing DB
        try {
            await pool.query(`ALTER TABLE Orders ADD COLUMN status VARCHAR(20) DEFAULT 'Pending'`);
            await pool.query(`ALTER TABLE Orders ADD COLUMN delivered_at DATETIME NULL`);
            console.log("Migration: Added status and delivered_at columns to Orders table.");
        } catch (err) {
            // Error code 1060: Duplicate column name (already exists) - safe to ignore
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.error("Migration warning:", err.message);
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Order_Details (
                order_detail_id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT NOT NULL,
                item_id INT NOT NULL,
                quantity INT NOT NULL CHECK (quantity > 0),
                FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES Menu(item_id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Payment (
                payment_id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT UNIQUE NOT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
            )
        `);

        // Seed default staff with hashed password if empty
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM Staff");
        if (rows[0].count === 0) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);
            
            await pool.query(`
                INSERT INTO Staff (name, email, password, role) VALUES 
                ('Alice Manager', 'alice@aura.cafe', ?, 'Manager'),
                ('Bob Barista', 'bob@aura.cafe', ?, 'Barista'),
                ('Ram', 'ram@gmail.com', ?, 'Manager')
            `, [hashedPassword, hashedPassword, hashedPassword]);
            console.log("Seeded default staff with password: password123");
        }

        // Seed Menu if empty
        const [menuRows] = await pool.query("SELECT COUNT(*) as count FROM Menu");
        if (menuRows[0].count === 0) {
            await pool.query(`
                INSERT INTO Menu (item_name, price) VALUES 
                ('Espresso', 60), ('Latte', 90), ('Cappuccino', 80), 
                ('Blueberry Muffin', 100), ('Croissant', 40), ('Iced Frap', 120),
                ('Green Tea', 50), ('Milk Tea', 70), ('Ice Cream', 80)
            `);
        }

        console.log("Database initialized successfully with MySQL!");
    } catch (err) {
        console.error("Database initialization failed:", err.message);
        throw err;
    }
}

function getDB() {
    if (!pool) throw new Error("DB pool was not created. Call initDB first.");
    return pool;
}

module.exports = { initDB, getDB };
