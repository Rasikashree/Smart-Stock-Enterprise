#!/bin/bash
# SmartStock Enterprise - Quick Start Script (Linux/Mac)

echo ""
echo "========================================"
echo " SmartStock Enterprise - Quick Start"
echo "========================================"
echo ""

DB_NAME="smartstock"
DB_USER="postgres"
DB_PASSWORD="postgres"
BACKEND_PORT=8080
FRONTEND_PORT=3000

echo ""
echo "[1/5] Checking prerequisites..."
if ! command -v java &> /dev/null; then
    echo "ERROR: Java not found. Please install Java 17+"
    exit 1
fi

if ! command -v mvn &> /dev/null; then
    echo "ERROR: Maven not found. Please install Maven"
    exit 1
fi

echo "[OK] Java and Maven found"

echo ""
echo "[2/5] Creating database..."
echo "WARNING: Ensure PostgreSQL is running"
echo ""
echo "Creating database: $DB_NAME"
# createdb -U postgres $DB_NAME
echo "[SKIP] Database creation (please run manually or use Supabase)"

echo ""
echo "[3/5] Building backend..."
cd backend
mvn clean install -q
if [ $? -ne 0 ]; then
    echo "ERROR: Maven build failed"
    cd ..
    exit 1
fi
echo "[OK] Backend built successfully"

echo ""
echo "[4/5] Starting backend..."
echo "Starting Spring Boot on port $BACKEND_PORT..."
mvn spring-boot:run &
BACKEND_PID=$!
sleep 10

echo ""
echo "[5/5] Starting frontend..."
cd ../frontend
echo "Starting frontend server on port $FRONTEND_PORT..."

if command -v python3 &> /dev/null; then
    python3 -m http.server $FRONTEND_PORT
elif command -v python &> /dev/null; then
    python -m http.server $FRONTEND_PORT
elif command -v npx &> /dev/null; then
    npx http-server -p $FRONTEND_PORT
else
    echo "ERROR: No HTTP server found. Install Python or Node.js"
    exit 1
fi

echo ""
echo "========================================"
echo " SmartStock is ready!"
echo "========================================"
echo ""
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT/api"
echo ""
echo "Test credentials:"
echo "  Phone: 9876543210"
echo "  OTP:   123456"
echo ""
echo "Admin credentials:"
echo "  Phone: 9999999999"
echo "  OTP:   123456"
echo ""
echo "Press Ctrl+C to stop"
