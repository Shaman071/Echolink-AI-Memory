# EchoLink Complete Startup and Verification Script
# This script starts all services and verifies they're working correctly

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  EchoLink - Complete System Startup   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$services = @()

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
}

# Check MongoDB connection
Write-Host "[1/6] Checking MongoDB connection..." -ForegroundColor Yellow
try {
    $mongoUri = $env:MONGODB_URI
    if (-not $mongoUri) {
        Write-Host "  ⚠️  MONGODB_URI not set in environment" -ForegroundColor Red
    } else {
        Write-Host "  ✓ MongoDB URI configured" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ MongoDB check failed: $_" -ForegroundColor Red
}
Write-Host ""

# Start Embedding Service (Python)
Write-Host "[2/6] Starting Embedding Service (Python)..." -ForegroundColor Yellow
try {
    $embedPath = "d:\Echolink\embed_service"
    if (Test-Path $embedPath) {
        Write-Host "  Checking if port 5000 is free..." -ForegroundColor Gray
        if (Test-Port 5000) {
            Write-Host "  ⚠️  Port 5000 already in use (embedding service may already be running)" -ForegroundColor Yellow
        } else {
            Write-Host "  Starting embedding service on port 5000..." -ForegroundColor Gray
            $embedProcess = Start-Process -FilePath "python" -ArgumentList "app.py" -WorkingDirectory $embedPath -PassThru -WindowStyle Normal
            $services += @{ Name = "Embedding Service"; Process = $embedProcess; Port = 5000 }
            Start-Sleep -Seconds 3
            Write-Host "  ✓ Embedding service started (PID: $($embedProcess.Id))" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✗ Embedding service path not found: $embedPath" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Failed to start embedding service: $_" -ForegroundColor Red
}
Write-Host ""

# Start Backend (Node.js)
Write-Host "[3/6] Starting Backend API (Node.js)..." -ForegroundColor Yellow
try {
    $backendPath = "d:\Echolink\backend"
    if (Test-Path $backendPath) {
        Write-Host "  Checking if port 3001 is free..." -ForegroundColor Gray
        if (Test-Port 3001) {
            Write-Host "  ⚠️  Port 3001 already in use (backend may already be running)" -ForegroundColor Yellow
        } else {
            Write-Host "  Starting backend on port 3001..." -ForegroundColor Gray
            $backendProcess = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $backendPath -PassThru -WindowStyle Normal
            $services += @{ Name = "Backend API"; Process = $backendProcess; Port = 3001 }
            Start-Sleep -Seconds 5
            Write-Host "  ✓ Backend API started (PID: $($backendProcess.Id))" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✗ Backend path not found: $backendPath" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Failed to start backend: $_" -ForegroundColor Red
}
Write-Host ""

# Start Frontend (Vite)
Write-Host "[4/6] Starting Frontend (Vite)..." -ForegroundColor Yellow
try {
    $frontendPath = "d:\Echolink\frontend"
    if (Test-Path $frontendPath) {
        Write-Host "  Checking if port 3000 is free..." -ForegroundColor Gray
        if (Test-Port 3000) {
            Write-Host "  ⚠️  Port 3000 already in use (frontend may already be running)" -ForegroundColor Yellow
        } else {
            Write-Host "  Starting frontend on port 3000..." -ForegroundColor Gray
            $frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendPath -PassThru -WindowStyle Normal
            $services += @{ Name = "Frontend"; Process = $frontendProcess; Port = 3000 }
            Start-Sleep -Seconds 3
            Write-Host "  ✓ Frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✗ Frontend path not found: $frontendPath" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Failed to start frontend: $_" -ForegroundColor Red
}
Write-Host ""

# Verify Services
Write-Host "[5/6] Verifying Services..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check Embedding Service
Write-Host "  Checking embedding service health..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $health = $response.Content | ConvertFrom-Json
        Write-Host "  ✓ Embedding Service: $($health.status) (Model: $($health.model))" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Embedding service not responding on port 5000" -ForegroundColor Red
}

# Check Backend
Write-Host "  Checking backend API health..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $health = $response.Content | ConvertFrom-Json
        Write-Host "  ✓ Backend API: $($health.status)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Backend API not responding on port 3001" -ForegroundColor Red
}

# Check Frontend
Write-Host "  Checking frontend..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Frontend: Running" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Frontend not responding on port 3000" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "[6/6] Startup Summary" -ForegroundColor Yellow
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Services Running:" -ForegroundColor White
foreach ($service in $services) {
    Write-Host "    • $($service.Name) (Port: $($service.Port), PID: $($service.Process.Id))" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Access Points:" -ForegroundColor White
Write-Host "    • Frontend:  http://localhost:3000" -ForegroundColor Green
Write-Host "    • Backend:   http://localhost:3001/api" -ForegroundColor Green
Write-Host "    • Embedding: http://localhost:5000" -ForegroundColor Green
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor White
Write-Host "    1. Open http://localhost:3000 in your browser" -ForegroundColor Gray
Write-Host "    2. Register a new account" -ForegroundColor Gray
Write-Host "    3. Upload a test file (sample_whatsapp.txt)" -ForegroundColor Gray
Write-Host "    4. Try searching for content" -ForegroundColor Gray
Write-Host ""
Write-Host "  To stop all services, press Ctrl+C or close their windows" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  System Ready! Happy Coding! 🚀" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
