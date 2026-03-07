Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "EchoLink Setup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if command exists
function Test-Command($command) {
    try {
        if (Get-Command $command -ErrorAction Stop) {
            return $true
        }
    } catch {
        return $false
    }
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-Command "node")) {
    Write-Host "[ERROR] Node.js is not installed. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "python")) {
    Write-Host "[ERROR] Python is not installed. Please install Python 3.8+ from https://python.org" -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "mongod")) {
    Write-Host "[WARNING] MongoDB is not found in PATH. Make sure MongoDB is installed and running." -ForegroundColor Yellow
}

Write-Host "[OK] Prerequisites check passed!" -ForegroundColor Green
Write-Host ""

# Setup Backend
Write-Host "Setting up Backend..." -ForegroundColor Yellow
Set-Location backend

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "Backend dependencies already installed, skipping..." -ForegroundColor Green
}

if (-not (Test-Path "uploads")) {
    Write-Host "Creating uploads directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path "uploads" | Out-Null
}

if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Cyan
    Copy-Item ".env.example" ".env"
    Write-Host "[ACTION REQUIRED] Please edit backend/.env and configure your settings!" -ForegroundColor Yellow
}

Set-Location ..

# Setup Embedding Service
Write-Host ""
Write-Host "Setting up Embedding Service..." -ForegroundColor Yellow
Set-Location embed_service

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

Write-Host "Activating virtual environment and installing dependencies..." -ForegroundColor Cyan
& .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
deactivate

Set-Location ..

# Setup Frontend
Write-Host ""
Write-Host "Setting up Frontend..." -ForegroundColor Yellow
Set-Location frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "Frontend dependencies already installed, skipping..." -ForegroundColor Green
}

if (-not (Test-Path ".env")) {
    Write-Host "Creating frontend .env file..." -ForegroundColor Cyan
    "VITE_API_URL=http://localhost:3001/api" | Out-File -FilePath ".env" -Encoding UTF8
}

Set-Location ..

# Summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit backend/.env with your MongoDB URI and other settings" -ForegroundColor White
Write-Host "2. Make sure MongoDB is running" -ForegroundColor White
Write-Host "3. Open 3 terminals and run:" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 1 (Backend):" -ForegroundColor Cyan
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 2 (Embedding Service):" -ForegroundColor Cyan
Write-Host "   cd embed_service" -ForegroundColor White
Write-Host "   .\.venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "   python app.py" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 3 (Frontend):" -ForegroundColor Cyan
Write-Host "   cd frontend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Access the app at http://localhost:3000" -ForegroundColor Green
Write-Host ""
