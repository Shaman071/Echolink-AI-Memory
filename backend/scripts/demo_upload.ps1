# Demo script: register, login, and upload sample WhatsApp file using curl
# Usage: .\demo_upload.ps1

$api = 'http://localhost:3001/api'
$cookieFile = 'cookies.txt'

# 1) Register
$registerBody = '{"name":"Demo User","email":"demo+ps@example.com","password":"Demo12345"}'
Write-Host "Registering user..."
curl.exe -s -X POST "$api/auth/register" -H "Content-Type: application/json" -d $registerBody -c $cookieFile -o register.json
Write-Host "Response:"
Get-Content register.json | Write-Host

# 2) Login (to ensure cookie is set)
$loginBody = '{"email":"demo+ps@example.com","password":"Demo12345"}'
Write-Host "Logging in..."
curl.exe -s -X POST "$api/auth/login" -H "Content-Type: application/json" -d $loginBody -c $cookieFile -o login.json
Get-Content login.json | Write-Host

# 3) Upload sample WhatsApp file
$sample = "..\..\sample_data\sample_whatsapp.txt"
if (!(Test-Path $sample)) {
  Write-Host "Sample file not found: $sample" -ForegroundColor Yellow
  exit 1
}
Write-Host "Uploading sample WhatsApp file..."
# Use curl to upload file and send cookies
curl.exe -s -X POST "$api/import/whatsapp" -F "file=@$sample" -b $cookieFile -o upload.json
Write-Host "Upload response:"
Get-Content upload.json | Write-Host

Write-Host "Demo completed. Cookies saved to $cookieFile. Check the frontend at http://localhost:3000 to login and explore."