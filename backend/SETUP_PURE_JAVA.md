# SmartStock Backend - Pure Java Setup (No Maven)

## 📋 Quick Start (2 minutes)

### Step 1: Download PostgreSQL JDBC Driver
```powershell
# Create lib folder
mkdir lib

# Download PostgreSQL JDBC driver to lib folder
# Download from: https://jdbc.postgresql.org/download/
# OR use this direct link and extract to lib:
# https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.1/postgresql-42.7.1.jar
```

Or download manually:
1. Go to https://jdbc.postgresql.org/download/
2. Download the `.jar` file 
3. Extract/save to `backend/lib/` folder

### Step 2: Compile Java
```powershell
cd backend

# Compile (replace 42.7.1 with your version)
javac -cp lib/postgresql-42.7.1.jar SmartStockBackend.java

# Should complete without errors
# If error: check JAVA_HOME is set
```

### Step 3: Run Backend
```powershell
# Run (replace 42.7.1 with your version)
java -cp lib/postgresql-42.7.1.jar:. SmartStockBackend

# Should show:
# 🚀 SmartStock Backend Starting (Pure Java, No Maven)...
# ✅ Database connected!
# ✅ SmartStock Backend running on http://localhost:8080
```

---

## 🧪 Test Endpoints

Once backend is running, test in **new PowerShell tab**:

```powershell
# Get all products
curl http://localhost:8080/api/products

# Send OTP
curl -X POST http://localhost:8080/api/otp/send `
  -H "Content-Type: application/json" `
  -d '{"phone":"9442290033"}'

# Verify OTP (demo: 123456)
curl -X POST http://localhost:8080/api/otp/verify `
 -H "Content-Type: application/json" `
  -d '{"phone":"9442290033","otp":"123456"}'

# Add to cart (smart locking)
curl -X POST http://localhost:8080/api/cart/add `
  -H "Content-Type: application/json" `
  -d '{"phone":"9442290033","productId":5,"quantity":1}'

# Admin dashboard
curl http://localhost:8080/api/admin/dashboard

# Health check
curl http://localhost:8080/api/health
```

---

## 📊 Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/otp/send` | POST | Send OTP to phone |
| `/api/otp/verify` | POST | Verify OTP and get token |
| `/api/products` | GET | List all products |
| `/api/cart/add` | POST | Add item to cart (smart locking) |
| `/api/cart` | GET | Get active locks |
| `/api/admin/dashboard` | GET | Admin KPIs |
| `/api/health` | GET | Health check |
| `/` | GET | API info |

---

## 🔧 Troubleshooting

### Error: "cannot find symbol" during compilation
- Make sure PostgreSQL JDBC jar is in `lib` folder
- Check jar filename matches in `-cp` argument

### Error: "Connection refused"
- Supabase database might be down
- Check credentials in SmartStockBackend.java

### Error: "ClassNotFoundException: org.postgresql.Driver"
- PostgreSQL JDBC jar not in classpath
- Use: `java -cp lib/postgresql-42.7.1.jar:. SmartStockBackend`

---

## ✅ Database Prerequisites

Before running, ensure your Supabase database has these tables:
```sql
-- Run in Supabase → SQL Editor:

-- From supabase/schema.sql
[copy entire schema.sql content]

-- From supabase/realtime.sql
[copy entire realtime.sql content]

-- From supabase/cron.sql
[copy entire cron.sql content]
```

---

## 🚀 Next Steps

Once backend is running:

1. **Update Frontend**: Change API URL in `frontend/script.js`:
```javascript
const API_BASE = 'http://localhost:8080/api';  // For local testing
```

2. **Open Frontend**:
```powershell
# In new terminal tab, from frontend folder
python -m http.server 3000  # Requires Python
# OR just open frontend/index.html in browser
```

3. **Test Full Flow**:
   - Open http://localhost:3000 or file:///path/to/frontend/index.html
   - Login: Phone `9442290033`, OTP `123456`
   - Add products to cart
   - Test smart locking (items with stock < 10)

---

## 📦 Benefits of Pure Java

- ✅ **No build system** - just `javac` and `java`
- ✅ **Only 1 dependency** - PostgreSQL JDBC driver (12MB)
- ✅ **Fast compile** - seconds, not minutes
- ✅ **Easy to modify** - edit and recompile
- ✅ **True standalone** - one .class file runs entire backend
- ✅ **Lightweight server** - Java's built-in HttpServer

---

## 📝 Files

- **SmartStockBackend.java** - Complete backend (800 lines)
- **lib/postgresql-42.7.1.jar** - Database driver (you provide)

That's it! Pure Java, zero complexity. 🎉
