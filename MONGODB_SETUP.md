# MongoDB Setup Guide for SmartStock Enterprise

## Option A: Local MongoDB Setup (RECOMMENDED)

### Step 1: Download MongoDB Community Edition
1. Visit: https://www.mongodb.com/try/download/community
2. Select your OS (Windows)
3. Download the MSI installer
4. Run the installer with default settings

### Step 2: Start MongoDB Service
```powershell
# In PowerShell (Admin)
net start MongoDB
```

Or start it manually:
```powershell
mongod --dbpath "C:\data\db"
```

### Step 3: Verify MongoDB is Running
```powershell
# Your MongoDB should be accessible at:
mongodb://localhost:27017
```

### Step 4: Update Backend Connection String

Edit `backend/SmartStockBackend.java` and change:

```java
// Change from:
private static final String MONGODB_URI = "mongodb+srv://rasikashree1991_db_user:Rasika%401526@cluster0.xz5ld8l.mongodb.net/smartstock?retryWrites=true&w=majority";

// To:
private static final String MONGODB_URI = "mongodb://localhost:27017/smartstock";
```

### Step 5: Rebuild and Run
```powershell
cd backend
mvn clean package
java -jar target/smartstock-enterprise-1.0.0.jar
```

---

## Option B: MongoDB Atlas Fix

If you want to keep using MongoDB Atlas, the SSL/TLS error indicates:

**Possible causes:**
1. **IP Whitelist** - Your IP not added to Atlas
   - Go to: https://cloud.mongodb.com
   - Security → Network Access
   - Add your IP (or 0.0.0.0/0 for testing)

2. **TLS Version Issue** - Java not supporting required TLS
   - Add to `java -jar` command:
   ```
   -Dcom.sun.jndi.ldap.connect.pool=false
   ```

3. **Connection String Format**
   - Ensure password is URL encoded: `Rasika@1526` → `Rasika%401526` ✓

---

## Option C: Implement Real MongoDB CRUD Operations

The backend code has mock data returning methods. To use real MongoDB:

**Current mock structure:**
- `getProducts()` → Returns hardcoded JSON
- `addToCart()` → Returns demo response
- `getActiveLocks()` → Returns empty array

**To implement real operations**, would require:
1. Create MongoDB collections: `products`, `carts`, `orders`
2. Replace mock returns with actual queries
3. Implement insert/update/delete operations

---

## Quick Verification

After changing connection string, test with:

```bash
# Check if MongoDB is running
curl http://localhost:27017

# Expected response: MongoDB shell would connect
# (Web interface may show "not authorized for access to this database")
```

---

## Connection Strings Reference

| Option | Connection String |
|--------|-------------------|
| **Local MongoDB** | `mongodb://localhost:27017/smartstock` |
| **MongoDB Atlas** (Current) | `mongodb+srv://rasikashree1991_db_user:Rasika%401526@cluster0.xz5ld8l.mongodb.net/smartstock?retryWrites=true&w=majority` |
| **Local with Auth** | `mongodb://username:password@localhost:27017/smartstock` |

---

## Troubleshooting

**Error: "Connection refused"**
- MongoDB service not running
- Use: `net start MongoDB` (Windows)

**Error: "SSL/TLS handshake failed"**
- Using Atlas credentials with wrong IP
- Local MongoDB selected but service not started

**Error: "Authentication failed"**
- Wrong credentials for Atlas
- Verify in https://cloud.mongodb.com → Database → Connection

---

## What to Tell Me

Please let me know which option you want:

- **Option A**: "Setup local MongoDB" → I'll update the connection string
- **Option B**: "Fix Atlas connection" → I'll help troubleshoot network
- **Option C**: "Implement CRUD operations" → I'll code real database interactions

Once you choose, I'll make the necessary changes! 🚀
