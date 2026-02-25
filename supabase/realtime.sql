-- SmartStock Enterprise - Supabase Realtime Configuration
-- Enable realtime for cart_locks and orders tables

-- ==================== ENABLE REALTIME ====================

-- Enable Realtime for cart_locks (Smart Locks)
ALTER PUBLICATION supabase_realtime ADD TABLE cart_locks;

-- Enable Realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable Realtime for products (for stock updates)
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ==================== REALTIME POLICIES ====================

-- RLS Policy for cart_locks: users can only see their own locks
CREATE POLICY "Users can view own locks" ON cart_locks
    FOR SELECT
    USING (TRUE); -- In production: verify JWT phone claim

-- RLS Policy for orders: users can only see their own orders
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT
    USING (TRUE); -- In production: verify JWT phone claim

-- RLS Policy for products: everyone can read
CREATE POLICY "Products are public" ON products
    FOR SELECT
    USING (TRUE);

-- ==================== WEBHOOK CONFIGURATION ====================

-- Note: Configure these webhooks in Supabase Dashboard:
-- 1. Cart Lock Expiry -> POST http://your-backend/webhooks/lock-expired
-- 2. Order Status Change -> POST http://your-backend/webhooks/order-updated
-- 3. Stock Depletion Alert -> POST http://your-backend/webhooks/low-stock

-- ==================== TRIGGERS ====================

-- Trigger to update products.updated_at on stock change
CREATE OR REPLACE FUNCTION update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_timestamp_trigger ON products;
CREATE TRIGGER update_product_timestamp_trigger
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_product_timestamp();

-- Trigger to update orders.updated_at on status change
CREATE OR REPLACE FUNCTION update_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_order_timestamp_trigger ON orders;
CREATE TRIGGER update_order_timestamp_trigger
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_order_timestamp();

-- ==================== AUTOMATIC LOCK EXPIRY ====================

-- This function marks locks as expired (run via Database Functions)
CREATE OR REPLACE FUNCTION expire_old_locks()
RETURNS void AS $$
BEGIN
    -- Mark expired locks
    UPDATE cart_locks
    SET status = 'expired'
    WHERE lock_expires < CURRENT_TIMESTAMP
    AND status = 'active';
    
    -- Return stock for expired locks
    UPDATE products p
    SET stock = stock + (
        SELECT COALESCE(SUM(qty), 0)
        FROM cart_locks cl
        WHERE cl.product_id = p.id
        AND cl.lock_expires < CURRENT_TIMESTAMP
        AND cl.status = 'expired'
    );
    
    -- Clean up expired locks
    DELETE FROM cart_locks
    WHERE lock_expires < CURRENT_TIMESTAMP - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ==================== ANALYTICS VIEWS ====================

-- Real-time analytics view for orders
CREATE OR REPLACE VIEW order_analytics AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as orders_count,
    SUM(total) as total_revenue,
    COUNT(DISTINCT phone) as unique_customers
FROM orders
WHERE status = 'confirmed'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Lock conversion rate view
CREATE OR REPLACE VIEW lock_conversion_stats AS
SELECT 
    DATE(cl.created_at) as date,
    COUNT(DISTINCT cl.id) as total_locks_created,
    COUNT(CASE WHEN cl.status = 'active' THEN 1 END) as active_locks,
    COUNT(CASE WHEN cl.status = 'expired' THEN 1 END) as expired_locks,
    ROUND(
        COUNT(CASE WHEN cl.status IN ('confirmed', 'purchased') THEN 1 END) * 100.0 / 
        COUNT(DISTINCT cl.id),
        2
    ) as conversion_rate_percent
FROM cart_locks cl
GROUP BY DATE(cl.created_at)
ORDER BY date DESC;

-- Low stock alerts view
CREATE OR REPLACE VIEW low_stock_alerts AS
SELECT 
    id,
    name,
    stock,
    category,
    CASE 
        WHEN stock < 3 THEN 'CRITICAL - RESTOCK IMMEDIATELY'
        WHEN stock < 5 THEN 'LOW - UPCOMING RESTOCK'
        WHEN stock < 10 THEN 'LIMITED - MONITOR'
        ELSE 'OK'
    END as alert_level
FROM products
WHERE stock < 10
ORDER BY stock ASC;

-- ==================== MAINTENANCE QUERIES ====================

-- Clean up completed orders older than 90 days
-- SCHEDULED: Run once per week
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION archive_old_orders()
RETURNS void AS $$
BEGIN
    UPDATE orders
    SET archived = TRUE
    WHERE status = 'completed'
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    DELETE FROM order_items
    WHERE order_id IN (
        SELECT id FROM orders WHERE archived = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- ==================== REPORTING QUERIES ====================

-- Top selling products (last 7 days)
CREATE OR REPLACE VIEW top_products_7day AS
SELECT 
    p.id,
    p.name,
    COUNT(*) as times_ordered,
    SUM((jsonb_extract_path_text(item, 'qty')::INTEGER)) as total_qty_sold,
    SUM(p.price * jsonb_extract_path_text(item, 'qty')::INTEGER) as revenue
FROM orders o
CROSS JOIN jsonb_array_elements(o.items) as item
JOIN products p ON p.id = (jsonb_extract_path_text(item, 'productId')::INTEGER)
WHERE o.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
AND o.status = 'confirmed'
GROUP BY p.id, p.name
ORDER BY revenue DESC
LIMIT 20;

-- Peak order times (last 30 days)
CREATE OR REPLACE VIEW peak_order_times AS
SELECT 
    EXTRACT(HOUR FROM created_at) as hour_of_day,
    COUNT(*) as orders_count,
    AVG(total) as avg_order_value
FROM orders
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
AND status = 'confirmed'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY orders_count DESC;
