-- ==========================================
-- CAFE MANAGEMENT SYSTEM DATABASE SCHEMA
-- ==========================================

-- 1. Create Staff table
CREATE TABLE IF NOT EXISTS Staff (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);

-- 2. Create Customer table
CREATE TABLE IF NOT EXISTS Customer (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL
);

-- 3. Create Menu table
CREATE TABLE IF NOT EXISTS Menu (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    item_name VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- 4. Create Orders table (One-to-Many with Customer)
CREATE TABLE IF NOT EXISTS Orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Pending',
    delivered_at DATETIME NULL,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE
);

-- 5. Create Order_Details table (Many-to-Many link between Orders and Menu)
CREATE TABLE IF NOT EXISTS Order_Details (
    order_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Menu(item_id) ON DELETE CASCADE
);

-- 6. Create Payment table (One-to-One with Orders)
CREATE TABLE IF NOT EXISTS Payment (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT UNIQUE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
);


-- ==========================================
-- SAMPLE DATA INSERTION
-- ==========================================

-- Insert Staff
INSERT IGNORE INTO Staff (name, email, password, role) VALUES 
('Alice Smith', 'alice@example.com', 'password123', 'Manager'),
('Bob Jones', 'bob@example.com', 'password123', 'Barista'),
('Charlie Brown', 'charlie@example.com', 'password123', 'Cashier');

-- Insert Customers
INSERT IGNORE INTO Customer (name, phone) VALUES 
('John Doe', '555-0101'),
('Jane Mary', '555-0102'),
('Tom Hardy', '555-0103');

-- Insert Menu Items
INSERT IGNORE INTO Menu (item_name, price) VALUES 
('Espresso', 3.50),
('Latte', 4.50),
('Cappuccino', 4.00),
('Blueberry Muffin', 3.00),
('Croissant', 2.50),
('Iced Frap', 5.50);

-- Insert Orders
INSERT IGNORE INTO Orders (order_id, customer_id, order_date) VALUES 
(1, 1, '2023-10-25 08:30:00'),
(2, 2, '2023-10-25 09:15:00'),
(3, 1, '2023-10-26 14:20:00');

-- Insert Order_Details
-- Order 1: John Doe ordered 1 Espresso and 2 Croissants
INSERT IGNORE INTO Order_Details (order_id, item_id, quantity) VALUES 
(1, 1, 1), 
(1, 5, 2); 

-- Order 2: Jane Mary ordered 2 Lattes and 1 Blueberry Muffin
INSERT IGNORE INTO Order_Details (order_id, item_id, quantity) VALUES 
(2, 2, 2), 
(2, 4, 1); 

-- Order 3: John Doe ordered 3 Iced Fraps
INSERT IGNORE INTO Order_Details (order_id, item_id, quantity) VALUES 
(3, 6, 3); 

-- Insert Payments
-- Order 1: Espresso (3.50) + 2x Croissants (2x 2.50) = 8.50
INSERT IGNORE INTO Payment (order_id, total_amount, payment_method) VALUES 
(1, 8.50, 'Credit Card');

-- Order 2: 2x Lattes (2x 4.50) + Muffin (3.00) = 12.00
INSERT IGNORE INTO Payment (order_id, total_amount, payment_method) VALUES 
(2, 12.00, 'Cash');

-- Order 3: 3x Iced Fraps (3x 5.50) = 16.50
INSERT IGNORE INTO Payment (order_id, total_amount, payment_method) VALUES 
(3, 16.50, 'Digital Wallet');


-- ==========================================
-- SQL QUERIES SPECIFIED IN REQUIREMENTS
-- ==========================================

-- A. Placing an order (Step 1: Create Order)
-- INSERT INTO Orders (customer_id) VALUES (1); 
-- Assume new order_id = 4 was generated

-- B. Adding multiple items to an order
-- INSERT INTO Order_Details (order_id, item_id, quantity) VALUES (4, 2, 1), (4, 5, 1);

-- C. Generating a bill with total amount for a specific order (e.g., Order 1)
SELECT 
    o.order_id, 
    c.name AS customer_name, 
    c.phone,
    m.item_name, 
    m.price,
    od.quantity, 
    (od.quantity * m.price) AS subtotal
FROM Orders o
JOIN Customer c ON o.customer_id = c.customer_id
JOIN Order_Details od ON o.order_id = od.order_id
JOIN Menu m ON od.item_id = m.item_id
WHERE o.order_id = 1;

-- To get just the total using Payment table:
SELECT order_id, total_amount FROM Payment WHERE order_id = 1;

-- D. Finding most sold items
SELECT 
    m.item_name, 
    SUM(od.quantity) AS total_sold
FROM Order_Details od
JOIN Menu m ON od.item_id = m.item_id
GROUP BY m.item_id, m.item_name
ORDER BY total_sold DESC 
LIMIT 5;

-- E. Daily sales report
SELECT 
    DATE(o.order_date) AS sale_date, 
    COUNT(DISTINCT o.order_id) AS total_orders, 
    SUM(p.total_amount) AS daily_revenue
FROM Orders o
JOIN Payment p ON o.order_id = p.order_id
GROUP BY DATE(o.order_date)
ORDER BY sale_date DESC;
