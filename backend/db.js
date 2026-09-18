const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'cafe_management.sqlite');
let db;

function initDB() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS Staff (
            staff_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            role       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Customer (
            customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            phone       TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Menu (
            item_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT UNIQUE NOT NULL,
            price     REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Orders (
            order_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            order_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
            status      TEXT DEFAULT 'Pending',
            delivered_at DATETIME,
            FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS Order_Details (
            order_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id        INTEGER NOT NULL,
            item_id         INTEGER NOT NULL,
            quantity        INTEGER NOT NULL CHECK (quantity > 0),
            FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
            FOREIGN KEY (item_id)  REFERENCES Menu(item_id)   ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS Payment (
            payment_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id       INTEGER UNIQUE NOT NULL,
            total_amount   REAL NOT NULL,
            payment_method TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
        );
    `);

    // Seed default staff if empty
    const staffCount = db.prepare('SELECT COUNT(*) as count FROM Staff').get();
    if (staffCount.count === 0) {
        const hashed = bcrypt.hashSync('password123', 10);
        db.prepare(`INSERT INTO Staff (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Alice Manager', 'alice@aura.cafe', hashed, 'Manager');
        db.prepare(`INSERT INTO Staff (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Bob Barista', 'bob@aura.cafe', hashed, 'Barista');
        db.prepare(`INSERT INTO Staff (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Ram', 'ram@gmail.com', hashed, 'Manager');
        console.log('Seeded default staff with password: password123');
    }

    // Ensure dedicated Admin account always exists
    const adminUser = db.prepare("SELECT * FROM Staff WHERE email = 'admin@aura.cafe'").get();
    if (!adminUser) {
        const hashedAdmin = bcrypt.hashSync('admin123', 10);
        db.prepare(`INSERT INTO Staff (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Admin Master', 'admin@aura.cafe', hashedAdmin, 'Admin');
        console.log('Created default Admin user: admin@aura.cafe / admin123');
    }

    // Seed Menu if empty
    const menuCount = db.prepare('SELECT COUNT(*) as count FROM Menu').get();
    if (menuCount.count === 0) {
        const items = [
            ['Espresso', 60], ['Latte', 90], ['Cappuccino', 80],
            ['Blueberry Muffin', 100], ['Croissant', 40], ['Iced Frap', 120],
            ['Green Tea', 50], ['Milk Tea', 70], ['Ice Cream', 80]
        ];
        const insert = db.prepare('INSERT INTO Menu (item_name, price) VALUES (?, ?)');
        for (const [name, price] of items) insert.run(name, price);
    }

    console.log('Database initialized successfully with SQLite!');
    return Promise.resolve(); // Keep async-compatible API
}

function getDB() {
    if (!db) throw new Error('DB not initialized. Call initDB first.');
    return db;
}

module.exports = { initDB, getDB };
