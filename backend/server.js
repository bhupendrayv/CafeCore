const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const { initDB, getDB } = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize DB, then start server
initDB().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
});

// Secure Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await getDB();
        
        // Find user by email
        const [rows] = await pool.query('SELECT * FROM Staff WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.staff_id, name: user.name, role: user.role },
            process.env.JWT_SECRET || 'supersecretkey123',
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.staff_id, name: user.name, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Secure Signup Route
app.post('/api/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const pool = await getDB();

        // 1. Check if user already exists
        const [existing] = await pool.query('SELECT * FROM Staff WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Staff email already registered.' });
        }

        // 2. Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Insert into DB
        await pool.query(
            'INSERT INTO Staff (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role || 'Cashier']
        );

        res.status(201).json({ success: true, message: 'Account created successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Existing Cafe API Routes (Migrated to MySQL)
app.get('/api/menu', async (req, res) => {
    try {
        const pool = await getDB();
        const [rows] = await pool.query('SELECT * FROM Menu');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Menu Management CRUD
app.post('/api/menu', async (req, res) => {
    const { item_name, price } = req.body;
    try {
        if (!item_name || !price) return res.status(400).json({ error: 'item_name and price are required' });
        const pool = await getDB();
        const [result] = await pool.query('INSERT INTO Menu (item_name, price) VALUES (?, ?)', [item_name, parseFloat(price)]);
        res.status(201).json({ success: true, item_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/menu/:id', async (req, res) => {
    const { item_name, price } = req.body;
    const itemId = req.params.id;
    try {
        if (!item_name || !price) return res.status(400).json({ error: 'item_name and price are required' });
        const pool = await getDB();
        const [result] = await pool.query('UPDATE Menu SET item_name = ?, price = ? WHERE item_id = ?', [item_name, parseFloat(price), itemId]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Menu item not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/menu/:id', async (req, res) => {
    const itemId = req.params.id;
    try {
        const pool = await getDB();
        const [result] = await pool.query('DELETE FROM Menu WHERE item_id = ?', [itemId]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Menu item not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/order', async (req, res) => {
    const { customerName, customerPhone, items, paymentMethod } = req.body;
    let connection;
    try {
        const pool = await getDB();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Find or create customer
        let [custRows] = await connection.query('SELECT customer_id FROM Customer WHERE phone = ?', [customerPhone]);
        let customerId;
        if (custRows.length > 0) {
            customerId = custRows[0].customer_id;
        } else {
            const [result] = await connection.query('INSERT INTO Customer (name, phone) VALUES (?, ?)', [customerName, customerPhone]);
            customerId = result.insertId;
        }

        // 2. Create order
        const [orderResult] = await connection.query('INSERT INTO Orders (customer_id) VALUES (?)', [customerId]);
        const orderId = orderResult.insertId;

        // 3. Add order details and calculate total
        let totalAmount = 0;
        for (const item of items) {
            await connection.query('INSERT INTO Order_Details (order_id, item_id, quantity) VALUES (?, ?, ?)', [orderId, item.item_id, item.quantity]);
            totalAmount += (item.quantity * item.price);
        }

        // 4. Create payment
        await connection.query('INSERT INTO Payment (order_id, total_amount, payment_method) VALUES (?, ?, ?)', [orderId, totalAmount, paymentMethod || 'Cash']);

        await connection.commit();
        res.json({ message: 'Order placed successfully', orderId, totalAmount });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/receipt/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const pool = await getDB();
        
        const query = `
            SELECT 
                o.order_id, 
                o.order_date,
                c.name AS customer_name, 
                c.phone,
                m.item_name, 
                m.price,
                od.quantity, 
                (od.quantity * m.price) AS subtotal,
                p.total_amount,
                p.payment_method
            FROM Orders o
            JOIN Customer c ON o.customer_id = c.customer_id
            JOIN Order_Details od ON o.order_id = od.order_id
            JOIN Menu m ON od.item_id = m.item_id
            JOIN Payment p ON o.order_id = p.order_id
            WHERE o.order_id = ?
        `;
        
        const [rows] = await pool.query(query, [orderId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        
        const receipt = {
            orderId: rows[0].order_id,
            date: rows[0].order_date,
            customerName: rows[0].customer_name,
            customerPhone: rows[0].phone,
            items: rows.map(r => ({
                name: r.item_name,
                price: parseFloat(r.price),
                quantity: r.quantity,
                subtotal: parseFloat(r.subtotal)
            })),
            totalAmount: parseFloat(rows[0].total_amount),
            paymentMethod: rows[0].payment_method
        };
        
        res.json(receipt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const pool = await getDB();
        
        const qMetrics = `SELECT COUNT(DISTINCT order_id) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_sales, COALESCE(AVG(total_amount), 0) AS avg_order_value FROM Payment`;
        const qTopItems = `SELECT m.item_name, SUM(od.quantity) as total_sold FROM Order_Details od JOIN Menu m ON od.item_id = m.item_id GROUP BY m.item_id, m.item_name ORDER BY total_sold DESC LIMIT 5`;
        const qRevMethods = `SELECT payment_method, SUM(total_amount) as revenue FROM Payment GROUP BY payment_method ORDER BY revenue DESC`;
        const qTrends = `SELECT DATE(o.order_date) as date, SUM(p.total_amount) as daily_revenue FROM Orders o JOIN Payment p ON o.order_id = p.order_id GROUP BY DATE(o.order_date) ORDER BY date ASC`;
        const qTopCust = `SELECT c.name, COUNT(o.order_id) as total_orders FROM Customer c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id HAVING total_orders >= 1 ORDER BY total_orders DESC LIMIT 5`;
        const qLowItems = `SELECT m.item_name, COALESCE(SUM(od.quantity), 0) as total_sold FROM Menu m LEFT JOIN Order_Details od ON m.item_id = od.item_id GROUP BY m.item_id ORDER BY total_sold ASC LIMIT 5`;

        const [[metricsRows], [topItems], [revMethods], [trends], [topCust], [lowItems]] = await Promise.all([
            pool.query(qMetrics),
            pool.query(qTopItems),
            pool.query(qRevMethods),
            pool.query(qTrends),
            pool.query(qTopCust),
            pool.query(qLowItems)
        ]);

        const metrics = metricsRows[0]; // single object, not array
        res.json({ metrics, topItems, revMethods, trends, topCust, lowItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/active', async (req, res) => {
    try {
        const pool = await getDB();
        
        const query = `
            SELECT 
                o.order_id, 
                o.order_date,
                o.status,
                c.name AS customer_name, 
                m.item_name, 
                od.quantity
            FROM Orders o
            JOIN Customer c ON o.customer_id = c.customer_id
            JOIN Order_Details od ON o.order_id = od.order_id
            JOIN Menu m ON od.item_id = m.item_id
            WHERE o.status = 'Pending'
            ORDER BY o.order_date ASC
        `;
        const [rows] = await pool.query(query);

        // Group rows by order ID
        const orders = {};
        for (const row of rows) {
            if (!orders[row.order_id]) {
                orders[row.order_id] = {
                    order_id: row.order_id,
                    order_date: row.order_date,
                    status: row.status,
                    customer_name: row.customer_name,
                    items: []
                };
            }
            orders[row.order_id].items.push({
                item_name: row.item_name,
                quantity: row.quantity
            });
        }
        
        res.json(Object.values(orders));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:id/deliver', async (req, res) => {
    try {
        const orderId = req.params.id;
        const pool = await getDB();
        
        // Update the order
        const [result] = await pool.query(
            "UPDATE Orders SET status = 'Delivered', delivered_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'Pending'", 
            [orderId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found or already delivered' });
        }

        // Fetch the updated order to calculate time taken
        const [rows] = await pool.query(
            "SELECT order_date, delivered_at, TIMESTAMPDIFF(SECOND, order_date, delivered_at) as time_taken_seconds FROM Orders WHERE order_id = ?", 
            [orderId]
        );

        res.json({ success: true, message: 'Order marked as delivered.', delivery_stats: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend paths for routing
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
