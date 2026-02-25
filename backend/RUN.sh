#!/bin/bash
# SmartStock Backend - Pure Java Startup (Mac/Linux)
# No Maven, No Spring Boot - Just Pure Java

cd backend

# Check if lib folder exists
if [ ! -d "lib" ]; then
    echo ""
    echo "❌ Error: lib folder not found!"
    echo ""
    echo "📥 Please download PostgreSQL JDBC driver:"
    echo "   1. Go to: https://jdbc.postgresql.org/download/"
    echo "   2. Download .jar file"
    echo "   3. Extract to: backend/lib/"
    echo ""
    exit 1
fi

# Find PostgreSQL jar
JDBC_JAR=$(ls lib/postgresql*.jar 2>/dev/null | head -1)

if [ -z "$JDBC_JAR" ]; then
    echo ""
    echo "❌ Error: PostgreSQL JDBC jar not found in lib folder!"
    echo ""
    echo "📥 Please download from: https://jdbc.postgresql.org/download/"
    echo ""
    exit 1
fi

echo ""
echo "🔨 Compiling Java..."
javac -cp "$JDBC_JAR" SmartStockBackend.java

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Compilation failed!"
    echo ""
    exit 1
fi

echo "✅ Compilation successful!"
echo ""
echo "🚀 Starting SmartStock Backend..."
echo ""
java -cp "$JDBC_JAR":. SmartStockBackend
