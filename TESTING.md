# SmartStock Enterprise - Smart Locking Test Scenarios

## 🧪 Complete Testing Guide

This document provides exact test scenarios to verify the 7-minute atomic locking feature works flawlessly.

---

## Test 1: Normal Add (Stock ≥ 10)

### Setup
- Product: Milk (productId=18)
- Stock: 30
- Users: 1

### Steps
1. Open `http://localhost:3000`
2. Login with 9876543210 / 123456
3. Find "Milk 1L"
4. Click "+ ADD"

### Expected Result
```
✓ "Milk 1L added to cart" notification
✓ Button shows "+ ADD" (not a counter)
✓ No lock timer appears
✓ Item in cart without "LOCKED" badge
✓ Backend response: {"isLocked": false}
```

### Verification
- Check browser console: `console.log(userCart)` → qty: 1
- Get cart: `GET /api/cart?phone=9876543210` → locks should be empty

---

## Test 2: Atomic Lock (Stock < 10)

### Setup
- Product: Cumin Seeds (productId=11, stock=5)
- Users: 1

### Steps
1. Login as above
2. Search for "Cumin Seeds"
3. Note: Badge shows "FLASH SALE: 5 left!"
4. Click "+ ADD"

### Expected Result
```
✓ "🔒 Cumin Seeds LOCKED for 7 minutes!" notification
✓ Item appears in "Items with Smart Locks" section
✓ Shows countdown timer "7:00"
✓ Backend response: {
    "isLocked": true,
    "lockId": 1,
    "lockExpiresAt": "2026-02-25T12:07:45"
  }
✓ Product stock decremented immediately (4 remaining)
```

### Verification
- Check Supabase `cart_locks` table: New record with status='active'
- Product stock in DB: 5 - 1 = 4
- Frontend shows lock expiring

---

## Test 3: Multiple Users Race Condition (Stock = 8)

### Setup
- Open 8 browser windows/tabs
- All on same product: Cardamom (productId=12, stock=3)
- Timing: Staggered 2-second intervals

### Steps
1. **User 1**: Click ADD → Lock #1 created (stock: 3→2)
2. **User 2**: Click ADD → Lock #2 created (stock: 2→1)
3. **User 3**: Click ADD → Lock #3 created (stock: 1→0)
4. **User 4**: Click ADD → ERROR "Sold Out"
5. **User 5-8**: Click ADD → ERROR "Sold Out"

### Expected Result
```
✓ Exactly 3 locks created
✓ Stock never goes negative
✓ Users 4-8 see "Sold Out" button
✓ Backend returns HTTP 400 with message
✓ NO invalid locks created
✓ NO duplicate locks
```

### Verification - Supabase Queries
```sql
-- Check locks created
SELECT * FROM cart_locks 
WHERE product_id = 12 AND status = 'active';
-- Result: Exactly 3 rows

-- Check stock
SELECT stock FROM products WHERE id = 12;
-- Result: 0

-- Check audit log
SELECT * FROM inventory_audit 
WHERE product_id = 12 
ORDER BY timestamp DESC;
```

---

## Test 4: Lock Auto-Expiry (7 minutes)

### Setup
- Create a lock (use Test 2)
- Note the lock ID (e.g., lockId: 1)
- Stock was 5, now 4

### Steps
1. Create lock for Cumin Seeds → lockId = 1
2. Observe timer counting down
3. Wait 7:05 minutes (or manually test)

### Expected Result
```
✓ Timer reaches 00:00
✓ Lock disappears from "Items with Smart Locks"
✓ Notification: "Cumin Seeds lock expired and item is removed"
✓ Stock auto-returns (5 - 1 = 4 → 5)
✓ Cart item removed
```

### Verification - Supabase
```sql
-- Check lock status after expiry
SELECT * FROM cart_locks WHERE id = 1;
-- Result: status = 'expired' (or deleted if >24 hours old)

-- Check stock returned
SELECT stock FROM products WHERE id = 11;
-- Result: 5 (original stock)
```

### Manual Test (Instant)
```bash
# Manually expire locks via Supabase SQL
SELECT manual_expire_locks(ARRAY[1]);
-- Checks if function executed successfully
```

---

## Test 5: Extend Lock (+7 minutes)

### Setup
- Active lock with 3 minutes remaining
- Lock ID: 1

### Steps
1. Cart shows lock with "3:24" remaining
2. Click "+7min" button
3. Observe timer resets

### Expected Result
```
✓ Timer resets to approximately 10:24
✓ "Lock extended by 7 minutes!" notification
✓ Original expiry time updated in DB
✓ Backend response: {
    "success": true,
    "newExpiresAt": "2026-02-25T12:17:45"
  }
```

### Verification
```sql
SELECT lock_expires FROM cart_locks WHERE id = 1;
-- Should be NOW() + 7 minutes
```

---

## Test 6: Payment Completes Lock

### Setup
- 2 items in cart:
  - 1 normal item (Milk, qty=2)
  - 1 locked item (Cumin, lockId=1)

### Steps
1. Go to Checkout
2. Fill address:
   - Name: John Doe
   - Phone: 9876543210
   - Address: 123 Main St
   - City: Bangalore
   - Postal: 560001
3. Click "Pay ₹XXX"
4. Use Razorpay test card:
   - Number: 4111 1111 1111 1111
   - Expiry: 12/25
   - OTP: 123456
5. Confirm payment

### Expected Result
```
✓ Payment shows "Processing..."
✓ Razorpay modal appears
✓ Payment accepts test card
✓ Success page: "Order #X"
✓ Backend response: order.status = 'confirmed'
✓ Lock DELETED (not returned to stock!)
✓ Stock remains deducted (permanent sale)
```

### Verification - Supabase
```sql
-- Check order created
SELECT * FROM orders WHERE id = 1;
-- Result: status = 'confirmed', razorpay_payment_id present

-- Check lock deleted
SELECT * FROM cart_locks WHERE id = 1;
-- Result: No rows (lock was DELETED during checkout)

-- Check stock (should be permanently reduced)
SELECT stock FROM products WHERE id = 11;
-- Result: 4 (paid=removed, NOT returned)
```

---

## Test 7: Concurrent Payment (2 Users, 1 Locked Item)

### Setup
- Cumin Seeds (stock: 3 → 2 remaining)
- Lock for User A: lockId = 1
- Lock for User B: lockId = 2

### Steps
**Simultaneously** (within 10 seconds):
1. **User A**: Checkout → Pay → Success
2. **User B**: Checkout → Pay → Should fail (item unavailable)

OR if stock allows:
1. **User A**: Checkout → Pay → Success (consumes lock)
2. **User B**: Receives order success (consumes 2nd lock)

### Expected Result
```
✓ First payment: Success, lock consumed
✓ Second payment: Either success (if stock allows) or waits
✓ Stock never oversells
✓ Both locks marked appropriately
✓ Audit log records both transactions
```

---

## Test 8: Admin Refill Stock

### Setup
- Cumin Seeds: stock = 1 (critically low)
- Admin phone: 9999999999

### Steps
1. Login as admin (9999999999 / 123456)
2. Go to "Admin Dashboard"
3. Under "Refill Stock":
   - Product: Cumin Seeds
   - Quantity: 20
   - Reason: "Warehouse delivery"
4. Click "Refill Stock"

### Expected Result
```
✓ "✓ Stock refilled and audit logged" notification
✓ Stock increases: 1 + 20 = 21
✓ Dashboard updates immediately
✓ Audit log shows:
  - admin_phone: 9999999999
  - product_id: 11
  - qty_change: 20
  - action: "Warehouse delivery"
```

### Verification
```sql
-- Check stock updated
SELECT stock FROM products WHERE id = 11;
-- Result: 21

-- Check audit log
SELECT * FROM inventory_audit 
WHERE product_id = 11 
ORDER BY timestamp DESC 
LIMIT 1;
-- Result: qty_change = 20, admin_phone = 9999999999
```

---

## Test 9: Stock < 10 Indicator

### Setup
- View homepage

### Expected Result
```
Each product shows stock status:

Stock ≥ 10:     ✓ "In Stock"           (green badge)
Stock 5-9:      ⚠ "Limited: 8 left"    (orange badge)
Stock 1-4:      🔴 "FLASH SALE: 3 left!" (red bold)
Stock 0:        ❌ [SOLD OUT] button disabled
```

### Verification
- Cumin (stock=5): Should show "FLASH SALE"
- Cardamom (stock=3): Should show "FLASH SALE"
- Milk (stock=30): Should show "In Stock"

---

## Test 10: Admin Dashboard KPIs

### Setup
- After running previous tests with multiple orders

### Expected Values
```
Active Locks:        Shows current active locks count
Low Stock < 10:      Lists products with stock < 10
Today Orders:        Count of today's confirmed orders
Total Revenue:       Sum of today's confirmed order totals
```

### Steps
1. Admin login (9999999999 / 123456)
2. View admin.html
3. Check KPI cards

### Verification
```bash
# Backend API
curl http://localhost:8080/api/admin/dashboard

# Response example:
{
  "activeLocks": 2,
  "lowStockCount": 5,
  "todayOrders": 3,
  "totalRevenue": 1250.50
}
```

---

## Test 11: CRON Job Expiry (Automated)

### Setup
- Multiple locks created
- Wait for next CRON cycle (every 1 minute)

### Expected Result
```
✓ Expired locks marked as 'expired' automatically
✓ Stock returned to products
✓ Audit trail for auto-expiry logged
✓ No manual intervention needed
```

### Verification - Supabase
```sql
-- Check CRON job status
SELECT * FROM cron.job;

-- Check successful runs
SELECT * FROM cron.job_cache;

-- Check expired locks were processed
SELECT COUNT(*) FROM cart_locks 
WHERE status = 'expired' 
AND DATE(created_at) = TODAY();
```

---

## Test 12: Stress Test (15 Concurrent Users)

### Setup
```bash
# Use Apache Bench or similar
ab -n 15 -c 15 \
  -p request.json \
  -T 'application/json' \
  http://localhost:8080/api/cart/add
```

### Request Body (request.json)
```json
{
  "phone": "user_{{concurrent_id}}",
  "productId": 5,
  "quantity": 1
}
```

### Expected Result
```
✓ All 15 requests processed
✓ Stock correctly allocated (5 locks max)
✓ No race conditions
✓ Response time < 500ms each
✓ No deadlocks
✓ Database connection pool handles load
```

---

## ✅ Test Summary Checklist

- [ ] Test 1: Normal Add (stock ≥ 10)
- [ ] Test 2: Atomic Lock (stock < 10)
- [ ] Test 3: Race Condition (8 users)
- [ ] Test 4: Lock Auto-Expiry
- [ ] Test 5: Extend Lock
- [ ] Test 6: Payment Completes
- [ ] Test 7: Concurrent Payments
- [ ] Test 8: Admin Refill
- [ ] Test 9: Stock Indicators
- [ ] Test 10: Dashboard KPIs
- [ ] Test 11: CRON Jobs
- [ ] Test 12: Stress Test (15 users)

---

## 🐛 Debug Commands

### Check All Locks
```sql
SELECT * FROM cart_locks ORDER BY created_at DESC;
```

### Check Stock Status
```sql
SELECT id, name, stock FROM products 
WHERE stock < 10 
ORDER BY stock ASC;
```

### Check Recent Orders
```sql
SELECT * FROM orders 
WHERE DATE(created_at) = TODAY() 
ORDER BY created_at DESC;
```

### Check Audit Log
```sql
SELECT * FROM inventory_audit 
ORDER BY timestamp DESC 
LIMIT 50;
```

### Manually Expire Locks
```sql
SELECT manual_expire_locks(ARRAY[1, 2, 3]);
```

### Check CRON Health
```sql
SELECT * FROM cron.job WHERE jobname LIKE 'expire%';
SELECT * FROM cron.job_cache LIMIT 10;
```

---

## 📊 Expected Metrics

After successful testing:

| Metric | Expected |
|--------|----------|
| Lock Creation Time | < 100ms |
| Lock Expiry Accuracy | ±1 second |
| Stock Consistency | 100% (no over-selling) |
| Payment Success Rate | 100% (test mode) |
| CRON Job Execution | Every 60 seconds ±5s |
| Database Response | < 50ms |

---

## 🎓 Key Testing Principles

1. **Atomic**: Each transaction all-or-nothing
2. **Isolated**: No interference between concurrent users
3. **Durable**: Data persists after payment
4. **Consistent**: Stock never oversells

---

**All tests passing? SmartStock is production-ready! 🚀**
