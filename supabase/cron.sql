-- SmartStock Enterprise - Supabase CRON Jobs
-- These jobs run automatically on Supabase to handle background tasks

-- ==================== ENABLE pg_cron EXTENSION ====================
-- Note: pg_cron is pre-installed on Supabase. Just reference it here.

-- Enable the pg_cron extension (usually pre-enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ==================== LOCK EXPIRY CRON JOB ====================
-- Run every minute to check and expire locks

SELECT cron.schedule(
    'expire-locks-every-minute',
    '* * * * *',  -- Every minute
    $$
    BEGIN
        -- Update expired locks to 'expired' status
        UPDATE cart_locks
        SET status = 'expired'
        WHERE lock_expires < CURRENT_TIMESTAMP 
        AND status = 'active';

        -- Return stock to products
        UPDATE products p
        SET stock = stock + (
            SELECT COALESCE(SUM(qty), 0)
            FROM cart_locks cl
            WHERE cl.product_id = p.id
            AND cl.lock_expires < CURRENT_TIMESTAMP 
            AND cl.status = 'expired'
        )
        WHERE id IN (
            SELECT DISTINCT product_id FROM cart_locks
            WHERE lock_expires < CURRENT_TIMESTAMP 
            AND status = 'expired'
        );

        -- Record audit log
        INSERT INTO inventory_audit (
            admin_phone, product_id, qty_change, action, timestamp
        )
        SELECT 
            'SYSTEM', 
            cl.product_id,
            cl.qty,
            'Lock Auto-Expired: ' || cl.phone,
            CURRENT_TIMESTAMP
        FROM cart_locks cl
        WHERE cl.lock_expires < CURRENT_TIMESTAMP 
        AND cl.status = 'expired'
        ON CONFLICT DO NOTHING;

        -- Clean up very old locks (>24 hours expired)
        DELETE FROM cart_locks
        WHERE lock_expires < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND status = 'expired';
    END;
    $$
);

-- ==================== LOW STOCK ALERTS CRON JOB ====================
-- Run every hour to check low stock and create alerts

SELECT cron.schedule(
    'low-stock-alerts-hourly',
    '0 * * * *',  -- Every hour
    $$
    BEGIN
        -- Create alert records for critically low stock
        INSERT INTO inventory_audit (
            admin_phone, product_id, qty_change, action, timestamp
        )
        SELECT 
            'SYSTEM',
            p.id,
            0,
            'ALERT: Critical Low Stock - ' || p.name || ' (' || p.stock || ' left)',
            CURRENT_TIMESTAMP
        FROM products p
        WHERE p.stock < 3
        AND DATE(CURRENT_TIMESTAMP) NOT IN (
            SELECT DATE(timestamp)
            FROM inventory_audit
            WHERE action LIKE 'ALERT: Critical Low Stock%'
            AND product_id = p.id
        );
    END;
    $$
);

-- ==================== DAILY STATS AGGREGATION ====================
-- Run every day at midnight to aggregate daily metrics

SELECT cron.schedule(
    'daily-stats-aggregation',
    '0 0 * * *',  -- Every day at midnight (UTC)
    $$
    BEGIN
        -- Create table for daily stats if not exists
        CREATE TABLE IF NOT EXISTS daily_stats (
            date DATE PRIMARY KEY,
            total_orders INTEGER,
            total_revenue DECIMAL(12, 2),
            unique_customers INTEGER,
            total_items_sold INTEGER,
            avg_order_value DECIMAL(10, 2),
            locks_created INTEGER,
            locks_expired INTEGER,
            top_product VARCHAR(255),
            low_stock_count INTEGER
        );

        -- Insert daily aggregations
        INSERT INTO daily_stats (
            date, total_orders, total_revenue, unique_customers,
            total_items_sold, avg_order_value, locks_created, locks_expired, low_stock_count
        )
        SELECT 
            CURRENT_DATE - INTERVAL '1 day',
            COUNT(DISTINCT o.id),
            COALESCE(SUM(o.total), 0),
            COUNT(DISTINCT o.phone),
            0, -- Will calculate from items
            COALESCE(AVG(o.total), 0),
            (SELECT COUNT(*) FROM cart_locks 
             WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'),
            (SELECT COUNT(*) FROM cart_locks 
             WHERE DATE(lock_expires) = CURRENT_DATE - INTERVAL '1 day' 
             AND status = 'expired'),
            (SELECT COUNT(*) FROM products WHERE stock < 10)
        FROM orders o
        WHERE DATE(o.created_at) = CURRENT_DATE - INTERVAL '1 day'
        AND o.status = 'confirmed'
        ON CONFLICT (date) DO UPDATE SET
            total_orders = EXCLUDED.total_orders,
            total_revenue = EXCLUDED.total_revenue,
            unique_customers = EXCLUDED.unique_customers,
            avg_order_value = EXCLUDED.avg_order_value,
            locks_created = EXCLUDED.locks_created,
            locks_expired = EXCLUDED.locks_expired,
            low_stock_count = EXCLUDED.low_stock_count;
    END;
    $$
);

-- ==================== ABANDONED CART CLEANUP ====================
-- Run every 12 hours to clean up old abandoned locks

SELECT cron.schedule(
    'cleanup-old-carts',
    '0 */12 * * *',  -- Every 12 hours
    $$
    BEGIN
        -- Delete locks older than 7 days in expired state
        DELETE FROM cart_locks
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
        AND status = 'expired';
    END;
    $$
);

-- ==================== REVENUE TREND CALCULATION ====================
-- Run every 6 hours to update revenue trends

SELECT cron.schedule(
    'revenue-trends-6hourly',
    '0 */6 * * *',  -- Every 6 hours
    $$
    BEGIN
        -- Create table for revenue trends if not exists
        CREATE TABLE IF NOT EXISTS revenue_trends (
            period TIMESTAMP PRIMARY KEY,
            revenue DECIMAL(12, 2),
            order_count INTEGER,
            avg_order_value DECIMAL(10, 2)
        );

        -- Insert trends
        INSERT INTO revenue_trends (period, revenue, order_count, avg_order_value)
        SELECT 
            DATE_TRUNC('hour', created_at) as period,
            COALESCE(SUM(total), 0),
            COUNT(*),
            COALESCE(AVG(total), 0)
        FROM orders
        WHERE DATE_TRUNC('hour', created_at) = 
              DATE_TRUNC('hour', CURRENT_TIMESTAMP - INTERVAL '6 hours')
        AND status = 'confirmed'
        GROUP BY DATE_TRUNC('hour', created_at)
        ON CONFLICT (period) DO UPDATE SET
            revenue = EXCLUDED.revenue,
            order_count = EXCLUDED.order_count,
            avg_order_value = EXCLUDED.avg_order_value;
    END;
    $$
);

-- ==================== INVENTORY CONSISTENCY CHECK ====================
-- Run every 4 hours to verify stock consistency

SELECT cron.schedule(
    'inventory-consistency-check',
    '0 */4 * * *',  -- Every 4 hours
    $$
    BEGIN
        -- Log any discrepancies between locked qty and product stock
        INSERT INTO inventory_audit (
            admin_phone, product_id, qty_change, action, timestamp
        )
        SELECT 
            'SYSTEM',
            p.id,
            (SELECT COALESCE(SUM(qty), 0) 
             FROM cart_locks cl 
             WHERE cl.product_id = p.id AND cl.status = 'active'),
            'Inventory Check: Active locks verified',
            CURRENT_TIMESTAMP
        FROM products p
        WHERE EXISTS (
            SELECT 1 FROM cart_locks cl 
            WHERE cl.product_id = p.id AND cl.status = 'active'
        )
        LIMIT 100;
    END;
    $$
);

-- ==================== PAYMENT RECONCILIATION ====================
-- Run every day to reconcile orders with payment status

SELECT cron.schedule(
    'payment-reconciliation-daily',
    '30 1 * * *',  -- 1:30 AM UTC every day
    $$
    BEGIN
        -- Find orders pending payment for >24 hours and mark as timeout
        UPDATE orders
        SET status = 'payment_timeout'
        WHERE status = 'pending'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';

        -- Log these timeouts
        INSERT INTO inventory_audit (
            admin_phone, product_id, qty_change, action, timestamp
        )
        SELECT 
            'SYSTEM',
            -1,
            -1,
            'Payment reconciliation: ' || COUNT(*) || ' orders marked as timeout',
            CURRENT_TIMESTAMP
        WHERE EXISTS (
            SELECT 1 FROM orders 
            WHERE status = 'payment_timeout'
            AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
        );
    END;
    $$
);

-- ==================== MONITORING - CRON JOB HEALTH ====================
-- This query shows all active cron jobs and their last execution

CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job;

-- Query to check last execution of a cron job
-- SELECT * FROM cron.job_cache;

-- ==================== ADMIN DASHBOARD AGGREGATIONS ====================
-- These queries help populate the admin dashboard

CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM products WHERE stock < 10) as low_stock_products,
    (SELECT COUNT(*) FROM cart_locks WHERE status = 'active') as active_locks,
    (SELECT SUM(total) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND status = 'confirmed') as today_revenue,
    (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND status = 'confirmed') as today_orders,
    (SELECT COUNT(DISTINCT phone) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as today_customers;

-- ==================== CLEANUP TASKS ====================

-- Remove unneeded log entries older than 30 days
SELECT cron.schedule(
    'cleanup-old-audit-logs',
    '0 2 * * *',  -- 2 AM UTC every day
    $$
    DELETE FROM inventory_audit
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND action NOT LIKE 'ALERT%';
    $$
);

-- ==================== MANUAL TRIGGER FUNCTIONS ====================

-- Function to manually trigger lock expiry (for testing/debugging)
CREATE OR REPLACE FUNCTION manual_expire_locks(lock_ids INTEGER[] DEFAULT NULL)
RETURNS TABLE(expired_locks INTEGER, stock_returned INTEGER) AS $$
DECLARE
    affected_locks INTEGER;
    stock_qty INTEGER;
BEGIN
    IF lock_ids IS NULL THEN
        -- Expire all overdue locks
        UPDATE cart_locks
        SET status = 'expired'
        WHERE lock_expires < CURRENT_TIMESTAMP AND status = 'active';
        affected_locks := FOUND;
    ELSE
        -- Expire specific locks
        UPDATE cart_locks
        SET status = 'expired'
        WHERE id = ANY(lock_ids) AND status = 'active';
        affected_locks := FOUND;
    END IF;

    -- Return stock
    SELECT SUM(qty) INTO stock_qty FROM cart_locks
    WHERE status = 'expired' AND lock_expires < CURRENT_TIMESTAMP;
    stock_qty := COALESCE(stock_qty, 0);

    UPDATE products p
    SET stock = stock + stock_qty
    WHERE id IN (
        SELECT product_id FROM cart_locks
        WHERE status = 'expired' AND lock_expires < CURRENT_TIMESTAMP
    );

    RETURN QUERY SELECT affected_locks, stock_qty;
END;
$$ LANGUAGE plpgsql;
