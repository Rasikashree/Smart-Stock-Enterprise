-- SmartStock Enterprise Database Schema for Supabase/PostgreSQL

-- ==================== PRODUCTS TABLE ====================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    is_flash_sale BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_products_flash_sale ON products(is_flash_sale);

-- ==================== SMART LOCKS TABLE ====================
CREATE TABLE IF NOT EXISTS cart_locks (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty INTEGER NOT NULL,
    lock_expires TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cart_locks_phone ON cart_locks(phone);
CREATE INDEX idx_cart_locks_product ON cart_locks(product_id);
CREATE INDEX idx_cart_locks_expires ON cart_locks(lock_expires);
CREATE INDEX idx_cart_locks_status ON cart_locks(status);

-- ==================== ORDERS TABLE ====================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    delivery_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_phone ON orders(phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_razorpay ON orders(razorpay_order_id);

-- ==================== INVENTORY AUDIT TABLE ====================
CREATE TABLE IF NOT EXISTS inventory_audit (
    id SERIAL PRIMARY KEY,
    admin_phone VARCHAR(20),
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty_change INTEGER NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_admin ON inventory_audit(admin_phone);
CREATE INDEX idx_audit_product ON inventory_audit(product_id);
CREATE INDEX idx_audit_timestamp ON inventory_audit(timestamp);

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_admin ON users(is_admin);

-- ==================== INITIAL DATA ====================

-- Truncate existing data
TRUNCATE TABLE cart_locks CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE inventory_audit CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE users CASCADE;

-- Insert sample products
INSERT INTO products (name, price, stock, category, image_url, is_flash_sale) VALUES
-- Breakfast Cereals
('Cornflakes 500g', 180.00, 25, 'groceries', 'https://via.placeholder.com/200?text=Cornflakes', FALSE),
('Muesli Mix 400g', 250.00, 8, 'groceries', 'https://via.placeholder.com/200?text=Muesli', FALSE),
('Oats Instant 200g', 120.00, 15, 'groceries', 'https://via.placeholder.com/200?text=Oats', FALSE),

-- Condiments
('Tomato Sauce 200ml', 80.00, 20, 'groceries', 'https://via.placeholder.com/200?text=Sauce', FALSE),
('Mayonnaise 300ml', 150.00, 6, 'groceries', 'https://via.placeholder.com/200?text=Mayo', FALSE),

-- Honey & Spreads
('Pure Honey 500ml', 350.00, 12, 'groceries', 'https://via.placeholder.com/200?text=Honey', FALSE),
('Peanut Butter 400g', 320.00, 9, 'groceries', 'https://via.placeholder.com/200?text=PB', FALSE),

-- Beverages
('Tea Powder 200g', 200.00, 18, 'beverages', 'https://via.placeholder.com/200?text=Tea', FALSE),
('Instant Coffee 100g', 280.00, 7, 'beverages', 'https://via.placeholder.com/200?text=Coffee', FALSE),

-- Spices
('Turmeric Powder 200g', 150.00, 10, 'groceries', 'https://via.placeholder.com/200?text=Turmeric', FALSE),
('Cumin Seeds 200g', 180.00, 5, 'groceries', 'https://via.placeholder.com/200?text=Cumin', TRUE),
('Cardamom 50g', 420.00, 3, 'groceries', 'https://via.placeholder.com/200?text=Cardamom', TRUE),

-- Dry Fruits
('Almonds 250g', 450.00, 11, 'groceries', 'https://via.placeholder.com/200?text=Almonds', FALSE),
('Cashews 200g', 520.00, 6, 'groceries', 'https://via.placeholder.com/200?text=Cashews', FALSE),

-- Staples
('Atta 5kg', 280.00, 22, 'groceries', 'https://via.placeholder.com/200?text=Atta', FALSE),
('Cooking Oil 1L', 180.00, 14, 'groceries', 'https://via.placeholder.com/200?text=Oil', FALSE),
('Rice 10kg', 520.00, 8, 'groceries', 'https://via.placeholder.com/200?text=Rice', FALSE),

-- Dairy
('Milk 1L', 60.00, 30, 'dairy', 'https://via.placeholder.com/200?text=Milk', FALSE),
('Yogurt 500ml', 80.00, 12, 'dairy', 'https://via.placeholder.com/200?text=Yogurt', FALSE),
('Cheese 200g', 280.00, 7, 'dairy', 'https://via.placeholder.com/200?text=Cheese', FALSE),
('Ghee 500ml', 450.00, 4, 'dairy', 'https://via.placeholder.com/200?text=Ghee', TRUE),

-- Bakery
('Bread Loaf', 50.00, 20, 'bakery', 'https://via.placeholder.com/200?text=Bread', FALSE),
('Butter 100g', 80.00, 9, 'bakery', 'https://via.placeholder.com/200?text=Butter', FALSE),

-- Snacks
('Chips 100g', 40.00, 25, 'snacks', 'https://via.placeholder.com/200?text=Chips', FALSE),
('Cookies 200g', 120.00, 8, 'snacks', 'https://via.placeholder.com/200?text=Cookies', FALSE),
('Dry Fruits Mix 250g', 380.00, 5, 'snacks', 'https://via.placeholder.com/200?text=Mix', TRUE);

-- Insert test admin user
INSERT INTO users (phone, is_admin) VALUES ('9999999999', TRUE);

-- Insert test regular user
INSERT INTO users (phone, is_admin) VALUES ('9876543210', FALSE);
