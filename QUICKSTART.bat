@echo off
REM SmartStock Enterprise - Quick Start Script (Windows)

echo.
echo ========================================
echo  SmartStock Enterprise - Quick Start
echo ========================================
echo.

set DB_NAME=smartstock
set DB_USER=postgres
set DB_PASSWORD=postgres
set BACKEND_PORT=8080
set FRONTEND_PORT=3000

echo.
echo [1/5] Checking prerequisites...
where java >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Java not found. Please install Java 17+
    exit /b 1
)

where mvn >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Maven not found. Please install Maven
    exit /b 1
)

echo [OK] Java and Maven found

echo.
echo [2/5] Creating database...
REM Note: Requires PostgreSQL installed and running
echo WARNING: Ensure PostgreSQL is running on localhost:5432
echo.
echo Creating database: %DB_NAME%
REM createdb -U postgres %DB_NAME%
echo [SKIP] Database creation (please run manually or use Supabase)

echo.
echo [3/5] Building backend...
cd backend
call mvn clean install -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Maven build failed
    cd ..
    exit /b 1
)
echo [OK] Backend built successfully

echo.
echo [4/5] Starting backend...
echo Starting Spring Boot on port %BACKEND_PORT%...
start cmd /k "mvn spring-boot:run"
timeout /t 10 /nobreak

echo.
echo [5/5] Starting frontend...
cd ..\frontend
echo Starting frontend server on port %FRONTEND_PORT%...
REM Try Python first
python -m http.server %FRONTEND_PORT% >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    REM Fall back to npx
    npx http-server -p %FRONTEND_PORT%
)

echo.
echo ========================================
echo  SmartStock is ready!
echo ========================================
echo.
echo Frontend: http://localhost:%FRONTEND_PORT%
echo Backend:  http://localhost:%BACKEND_PORT%/api
echo.
echo Test credentials:
echo   Phone: 9876543210
echo   OTP:   123456
echo.
echo Admin credentials:
echo   Phone: 9999999999
echo   OTP:   123456
echo.
pause
