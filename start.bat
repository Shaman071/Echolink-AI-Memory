@echo off
echo ====================================
echo EchoLink - Quick Start
echo ====================================
echo.

echo Starting all services...
echo.

echo [1/4] Checking MongoDB...
sc query MongoDB | find "RUNNING" >nul
if errorlevel 1 (
    echo MongoDB is not running. Starting MongoDB...
    net start MongoDB
) else (
    echo MongoDB is already running.
)
echo.

echo [2/4] Starting Backend Server...
start "EchoLink Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 >nul

echo [3/4] Starting Embedding Service...
start "EchoLink Embedding" cmd /k "cd embed_service && .venv\Scripts\activate && python app.py"
timeout /t 3 >nul

echo [4/4] Starting Frontend...
start "EchoLink Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ====================================
echo All services started!
echo ====================================
echo.
echo Backend:   http://localhost:3001
echo Frontend:  http://localhost:3000
echo Embedding: http://localhost:5000
echo.
echo Press any key to exit this window...
pause >nul
