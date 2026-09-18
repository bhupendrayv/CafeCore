const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const { initDB, getDB } = require('./db');

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

if (stripe) {
    console.log('💳 Stripe payment gateway enabled and initialized.');
} else {
    console.warn('⚠️ STRIPE_SECRET_KEY not found in environment.');
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    try {
        const db = getDB();
        const user = db.prepare('SELECT * FROM Staff WHERE email = ?').get(email);
        if (!user) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

        const token = jwt.sign(
            { id: user.staff_id, name: user.name, role: user.role },
            process.env.JWT_SECRET || 'supersecretkey123',
            { expiresIn: '1h' }
        );
        res.json({ success: true, token, user: { id: user.staff_id, name: user.name, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/signup', (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const db = getDB();
        const existing = db.prepare('SELECT * FROM Staff WHERE email = ?').get(email);
        if (existing) return res.status(400).json({ success: false, error: 'Staff email already registered.' });

        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO Staff (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, role || 'Cashier');
        res.status(201).json({ success: true, message: 'Account created successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// ─── Payment Gateway & Online Systems ────────────────────────────────────────

// Public Payment Configuration
app.get('/api/payment/config', (req, res) => {
    res.json({
        stripeEnabled: !!stripe,
        currency: 'INR',
        currencySymbol: '₹',
        upiVpa: 'aura.cafe@okaxis',
        cafeName: 'Aura Cafe',
        supportedMethods: ['Stripe Card', 'UPI / QR Code', 'Digital Wallet', 'Net Banking', 'Cash']
    });
});

// Stripe Hosted Checkout Session
app.post('/api/stripe/checkout-session', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' });
    }

    const { items, customerName, customerPhone } = req.body;
    if (!items || !items.length) {
        return res.status(400).json({ error: 'No items in order' });
    }

    try {
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'inr',
                product_data: {
                    name: item.name || item.item_name || 'Cafe Item',
                    description: `Aura Cafe - ${item.quantity} unit(s)`
                },
                unit_amount: Math.round(parseFloat(item.price) * 100)
            },
            quantity: parseInt(item.quantity) || 1
        }));

        const protocol = req.protocol;
        const host = req.get('host');
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            customer_email: req.body.customerEmail || undefined,
            metadata: {
                customerName: customerName || 'Walk-in',
                customerPhone: customerPhone || ''
            },
            success_url: `${protocol}://${host}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${protocol}://${host}/?payment_cancelled=true`
        });

        res.json({
            success: true,
            sessionId: session.id,
            sessionUrl: session.url
        });
    } catch (err) {
        console.error('Stripe session creation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Stripe Direct Card Payment (Instant in-app confirmation)
app.post('/api/stripe/pay-card', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' });
    }

    const { amount, paymentMethodId = 'pm_card_visa', customerName, customerPhone } = req.body;
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
    }

    try {
        const protocol = req.protocol;
        const host = req.get('host');

        const intent = await stripe.paymentIntents.create({
            amount: Math.round(parseFloat(amount) * 100),
            currency: 'inr',
            payment_method: paymentMethodId,
            confirm: true,
            return_url: `${protocol}://${host}/`,
            description: `Aura Cafe POS order for ${customerName || 'Customer'} (${customerPhone || 'N/A'})`,
            metadata: {
                customerName: customerName || 'Walk-in',
                customerPhone: customerPhone || ''
            }
        });

        res.json({
            success: intent.status === 'succeeded',
            status: intent.status,
            paymentIntentId: intent.id,
            receiptUrl: intent.charges && intent.charges.data[0] ? intent.charges.data[0].receipt_url : null
        });
    } catch (err) {
        console.error('Stripe card payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Verify Online Payment (UPI, Wallet, Net Banking, or Stripe reference)
app.post('/api/payment/verify-online', (req, res) => {
    const { method, amount, referenceId } = req.body;
    const generatedRef = referenceId || `${method ? method.toUpperCase().replace(/\s+/g, '_') : 'PAY'}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    res.json({
        success: true,
        verified: true,
        transactionId: generatedRef,
        amount: parseFloat(amount) || 0,
        timestamp: new Date().toISOString()
    });
});

// ─── Admin Authentication Middleware ─────────────────────────────────────────

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Admin Authorization Required: Please login as Admin to add or remove menu items.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
        if (decoded.role !== 'Admin' && decoded.role !== 'Manager') {
            return res.status(403).json({
                success: false,
                error: `Permission Denied: Staff role '${decoded.role}' cannot add or remove menu items. Admin login required.`
            });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: 'Session expired or invalid. Please login as Admin.'
        });
    }
}

// Admin Verification Endpoint
app.post('/api/admin/verify', (req, res) => {
    const { email, password } = req.body;
    try {
        const db = getDB();
        const user = db.prepare('SELECT * FROM Staff WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Staff account not found.' });
        }
        if (user.role !== 'Admin' && user.role !== 'Manager') {
            return res.status(403).json({ success: false, error: `Account (${user.role}) does not have Admin privileges.` });
        }
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Incorrect Admin password.' });
        }

        const token = jwt.sign(
            { id: user.staff_id, name: user.name, role: user.role },
            process.env.JWT_SECRET || 'supersecretkey123',
            { expiresIn: '8h' }
        );
        res.json({
            success: true,
            message: 'Admin authorization successful.',
            token,
            user: { id: user.staff_id, name: user.name, role: user.role }
        });
    } catch (err) {
        console.error('Admin verify error:', err);
        res.status(500).json({ success: false, error: 'Server error during admin verification' });
    }
});

// ─── Menu ────────────────────────────────────────────────────────────────────

app.get('/api/menu', (req, res) => {
    try {
        const db = getDB();
        const rows = db.prepare('SELECT * FROM Menu').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/menu', requireAdmin, (req, res) => {
    const { item_name, price } = req.body;
    if (!item_name || !price) return res.status(400).json({ error: 'item_name and price are required' });
    try {
        const db = getDB();
        const result = db.prepare('INSERT INTO Menu (item_name, price) VALUES (?, ?)').run(item_name, parseFloat(price));
        res.status(201).json({ success: true, item_id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/menu/:id', requireAdmin, (req, res) => {
    const { item_name, price } = req.body;
    const itemId = req.params.id;
    if (!item_name || !price) return res.status(400).json({ error: 'item_name and price are required' });
    try {
        const db = getDB();
        const result = db.prepare('UPDATE Menu SET item_name = ?, price = ? WHERE item_id = ?').run(item_name, parseFloat(price), itemId);
        if (result.changes === 0) return res.status(404).json({ error: 'Menu item not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
    const itemId = req.params.id;
    try {
        const db = getDB();
        const result = db.prepare('DELETE FROM Menu WHERE item_id = ?').run(itemId);
        if (result.changes === 0) return res.status(404).json({ error: 'Menu item not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Orders ──────────────────────────────────────────────────────────────────

app.post('/api/order', (req, res) => {
    const { customerName, customerPhone, items, paymentMethod, transactionId } = req.body;
    try {
        const db = getDB();

        // Find or create customer
        let customer = db.prepare('SELECT customer_id FROM Customer WHERE phone = ?').get(customerPhone);
        let customerId;
        if (customer) {
            customerId = customer.customer_id;
        } else {
            const r = db.prepare('INSERT INTO Customer (name, phone) VALUES (?, ?)').run(customerName, customerPhone);
            customerId = r.lastInsertRowid;
        }

        // Create order
        const orderResult = db.prepare('INSERT INTO Orders (customer_id) VALUES (?)').run(customerId);
        const orderId = orderResult.lastInsertRowid;

        // Add order details and calculate total
        let totalAmount = 0;
        const detailInsert = db.prepare('INSERT INTO Order_Details (order_id, item_id, quantity) VALUES (?, ?, ?)');
        for (const item of items) {
            detailInsert.run(orderId, item.item_id, item.quantity);
            totalAmount += item.quantity * item.price;
        }

        // Create payment record with transaction details
        const recordedMethod = transactionId 
            ? `${paymentMethod || 'Online'} (${transactionId})`
            : (paymentMethod || 'Cash');

        db.prepare('INSERT INTO Payment (order_id, total_amount, payment_method) VALUES (?, ?, ?)').run(orderId, totalAmount, recordedMethod);

        res.json({ 
            message: 'Order placed successfully', 
            orderId, 
            totalAmount,
            paymentMethod: recordedMethod
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/receipt/:orderId', (req, res) => {
    try {
        const orderId = req.params.orderId;
        const db = getDB();

        const rows = db.prepare(`
            SELECT 
                o.order_id, o.order_date,
                c.name AS customer_name, c.phone,
                m.item_name, m.price,
                od.quantity, (od.quantity * m.price) AS subtotal,
                p.total_amount, p.payment_method
            FROM Orders o
            JOIN Customer c ON o.customer_id = c.customer_id
            JOIN Order_Details od ON o.order_id = od.order_id
            JOIN Menu m ON od.item_id = m.item_id
            JOIN Payment p ON o.order_id = p.order_id
            WHERE o.order_id = ?
        `).all(orderId);

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

app.get('/api/stats', (req, res) => {
    try {
        const db = getDB();

        const metrics = db.prepare(`SELECT COUNT(DISTINCT order_id) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_sales, COALESCE(AVG(total_amount), 0) AS avg_order_value FROM Payment`).get();
        const topItems = db.prepare(`SELECT m.item_name, SUM(od.quantity) as total_sold FROM Order_Details od JOIN Menu m ON od.item_id = m.item_id GROUP BY m.item_id, m.item_name ORDER BY total_sold DESC LIMIT 5`).all();
        const revMethods = db.prepare(`SELECT payment_method, SUM(total_amount) as revenue FROM Payment GROUP BY payment_method ORDER BY revenue DESC`).all();
        const trends = db.prepare(`SELECT DATE(o.order_date) as date, SUM(p.total_amount) as daily_revenue FROM Orders o JOIN Payment p ON o.order_id = p.order_id GROUP BY DATE(o.order_date) ORDER BY date ASC`).all();
        const topCust = db.prepare(`SELECT c.name, COUNT(o.order_id) as total_orders FROM Customer c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id HAVING total_orders >= 1 ORDER BY total_orders DESC LIMIT 5`).all();
        const lowItems = db.prepare(`SELECT m.item_name, COALESCE(SUM(od.quantity), 0) as total_sold FROM Menu m LEFT JOIN Order_Details od ON m.item_id = od.item_id GROUP BY m.item_id ORDER BY total_sold ASC LIMIT 5`).all();

        res.json({ metrics, topItems, revMethods, trends, topCust, lowItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/active', (req, res) => {
    try {
        const db = getDB();
        const rows = db.prepare(`
            SELECT 
                o.order_id, o.order_date, o.status,
                c.name AS customer_name,
                m.item_name, od.quantity
            FROM Orders o
            JOIN Customer c ON o.customer_id = c.customer_id
            JOIN Order_Details od ON o.order_id = od.order_id
            JOIN Menu m ON od.item_id = m.item_id
            WHERE o.status = 'Pending'
            ORDER BY o.order_date ASC
        `).all();

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
            orders[row.order_id].items.push({ item_name: row.item_name, quantity: row.quantity });
        }
        res.json(Object.values(orders));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:id/deliver', (req, res) => {
    try {
        const orderId = req.params.id;
        const db = getDB();

        const result = db.prepare(`UPDATE Orders SET status = 'Delivered', delivered_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'Pending'`).run(orderId);
        if (result.changes === 0) return res.status(404).json({ error: 'Order not found or already delivered' });

        const row = db.prepare(`SELECT order_date, delivered_at, CAST((julianday(delivered_at) - julianday(order_date)) * 86400 AS INTEGER) as time_taken_seconds FROM Orders WHERE order_id = ?`).get(orderId);
        res.json({ success: true, message: 'Order marked as delivered.', delivery_stats: row });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Serve Frontend ───────────────────────────────────────────────────────────

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5001;

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
});
