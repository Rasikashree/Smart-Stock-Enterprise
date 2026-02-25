@echo off
REM SmartStock Backend - Pure Java Startup (Windows)
REM No Maven, No Spring Boot - Just Pure Java

cd backend

REM Check if lib folder exists
if not exist lib (
    echo.
    echo ❌ Error: lib folder not found!
    echo.
    echo 📥 Please download PostgreSQL JDBC driver:
    echo    1. Go to: https://jdbc.postgresql.org/download/
    echo    2. Download .jar file
    echo    3. Extract to: backend/lib/
    echo.
    pause
    exit /b 1
)

REM Find PostgreSQL jar
for %%f in (lib\postgresql*.jar) do (
    set JDBC_JAR=%%f
    goto found
)

:found
if not defined JDBC_JAR (
    echo.
    echo ❌ Error: PostgreSQL JDBC jar not found in lib folder!
    echo.
    echo 📥 Please download from: https://jdbc.postgresql.org/download/
    echo.
    pause
    exit /b 1
)

echo.
echo 🔨 Compiling Java...
javac -cp %JDBC_JAR% SmartStockBackend.java

if %errorlevel% neq 0 (
    echo.
    echo ❌ Compilation failed!
    echo.
    pause
    exit /b 1
)

echo ✅ Compilation successful!
echo.
echo 🚀 Starting SmartStock Backend...
echo.
java -cp %JDBC_JAR%;. SmartStockBackend

pause
