@echo off
REM ============================================================
REM  SmartStock Enterprise - Supabase PostgreSQL Backend Runner
REM ============================================================
echo.
echo ====================================================
echo   SmartStock Enterprise Backend (Supabase / JDBC)
echo ====================================================
echo.

REM ── Step 1: Move into backend folder ───────────────────────
cd /d "%~dp0"

REM ── Step 2: Locate PostgreSQL JDBC jar ─────────────────────
set JDBC_JAR=
for %%f in (lib\postgresql*.jar) do (
    set JDBC_JAR=%%f
    goto :found
)

:found
if not defined JDBC_JAR (
    echo [ERROR] PostgreSQL JDBC driver not found in lib\
    echo.
    echo  Download from: https://jdbc.postgresql.org/download/
    echo  Save to: backend\lib\postgresql-XX.X.X.jar
    echo.
    pause
    exit /b 1
)
echo [OK] JDBC driver: %JDBC_JAR%

REM ── Step 3: Check .env file ────────────────────────────────
if not exist .env (
    echo.
    echo [WARNING] .env file not found!
    echo   Create backend\.env with your Supabase credentials.
    echo   Example:
    echo     DB_HOST=db.YOUR_PROJECT_REF.supabase.co
    echo     DB_PORT=5432
    echo     DB_NAME=postgres
    echo     DB_USER=postgres
    echo     DB_PASSWORD=YOUR_PASSWORD
    echo.
) else (
    echo [OK] .env found
)

REM ── Step 4: Compile ────────────────────────────────────────
echo.
echo [*] Compiling SmartStockBackend.java ...
javac -encoding UTF-8 -cp "%JDBC_JAR%" SmartStockBackend.java

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Compilation failed! Check the error above.
    echo.
    pause
    exit /b 1
)
echo [OK] Compilation successful!

REM ── Step 5: Run ────────────────────────────────────────────
echo.
echo [*] Starting server...
echo     Press Ctrl+C to stop.
echo.
java -cp "%JDBC_JAR%;." SmartStockBackend

pause
