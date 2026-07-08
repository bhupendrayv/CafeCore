-- Insert sample data into cafe_db (safe, using INSERT IGNORE to skip duplicates)

USE cafe_db;

-- Insert Customers
INSERT IGNORE INTO Customer (name, phone) VALUES 
('John Doe', '555-0101'),
('Jane Mary', '555-0102'),
('Tom Hardy', '555-0103');

-- Insert Menu Items
INSERT IGNORE INTO Menu (item_name, price) VALUES 
('Espresso', 60), ('Latte', 90), ('Cappuccino', 80),
('Blueberry Muffin', 100), ('Croissant', 40), ('Iced Frap', 120),
('Green Tea', 50), ('Milk Tea', 70), ('Ice Cream', 80);

-- Insert Orders (only if none exist beyond the 2 already present)
INSERT INTO Orders (customer_id, order_date)
SELECT 1, '2023-10-25 08:30:00' WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE order_id = 1);

INSERT INTO Orders (customer_id, order_date)
SELECT 2, '2023-10-25 09:15:00' WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE order_id = 2);

INSERT INTO Orders (customer_id, order_date)
SELECT 1, '2023-10-26 14:20:00' WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE order_id = 3);

INSERT INTO Orders (customer_id, order_date)
SELECT 3, '2024-01-10 11:00:00' WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE order_id = 4);

INSERT INTO Orders (customer_id, order_date)
SELECT 2, '2024-01-11 15:30:00' WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE order_id = 5);

-- Insert Order_Details (ignore duplicates)
INSERT IGNORE INTO Order_Details (order_id, item_id, quantity) VALUES 
(1, 1, 1), (1, 5, 2),
(2, 2, 2), (2, 4, 1),
(3, 6, 3),
(4, 3, 2), (4, 7, 1),
(5, 1, 1), (5, 2, 1), (5, 6, 1);

-- Insert Payments (ignore duplicates)
INSERT IGNORE INTO Payment (order_id, total_amount, payment_method) VALUES 
(1, 140.00, 'Credit Card'),
(2, 280.00, 'Cash'),
(3, 360.00, 'Digital Wallet'),
(4, 210.00, 'Cash'),
(5, 270.00, 'Credit Card');
