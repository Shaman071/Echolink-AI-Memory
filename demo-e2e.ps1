# EchoLink End-to-End Demo Script
# This script demonstrates the complete workflow from upload to search

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  EchoLink End-to-End Demo   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001/api"
$embeddingUrl = "http://localhost:5000"

# Test credentials
$testEmail = "demo@echolink.local"
$testPassword = "Demo123!@#"
$testName = "Demo User"

Write-Host "[1/8] Checking Services..." -ForegroundColor Yellow
try {
    $embedHealth = Invoke-RestMethod -Uri "$embeddingUrl/health" -Method Get
    Write-Host "  ✓ Embedding Service: $($embedHealth.status)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Embedding Service not running on port 5000" -ForegroundColor Red
    Write-Host "    Start it with: cd embed_service && python app.py" -ForegroundColor Yellow
    exit 1
}

try {
    $backendHealth = Invoke-RestMethod -Uri "$baseUrl/../health" -Method Get
    Write-Host "  ✓ Backend API: $($backendHealth.status)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Backend API not running on port 3001" -ForegroundColor Red
    Write-Host "    Start it with: cd backend && npm start" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/8] Registering User..." -ForegroundColor Yellow
try {
    $registerBody = @{
        name = $testName
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    $token = $registerResponse.tokens.access.token
    Write-Host "  ✓ User registered successfully" -ForegroundColor Green
    Write-Host "    User ID: $($registerResponse.user.id)" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  ! User already exists, logging in..." -ForegroundColor Yellow
        
        $loginBody = @{
            email = $testEmail
            password = $testPassword
        } | ConvertTo-Json
        
        $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
        $token = $loginResponse.tokens.access.token
        Write-Host "  ✓ Logged in successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Registration failed: $_" -ForegroundColor Red
        exit 1
    }
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host ""
Write-Host "[3/8] Creating Test Document..." -ForegroundColor Yellow
$testText = @"
Today we discussed the new AI features for our application.
Bob mentioned that we should implement semantic search using embeddings.
Alice suggested using a knowledge graph to connect related information.
Charlie proposed using React for the frontend and Node.js for the backend.
The team agreed that MongoDB would be a good choice for the database.
We also talked about implementing user authentication with JWT tokens.
The project deadline is set for next month, and everyone is excited to start.
"@

$textBody = @{
    title = "Team Meeting Notes"
    text = $testText
} | ConvertTo-Json

try {
    $uploadResponse = Invoke-RestMethod -Uri "$baseUrl/import/text" -Method Post -Headers $headers -Body $textBody
    $sourceId = $uploadResponse.sourceId
    $fragmentCount = $uploadResponse.inserted
    Write-Host "  ✓ Document uploaded successfully" -ForegroundColor Green
    Write-Host "    Source ID: $sourceId" -ForegroundColor Gray
    Write-Host "    Fragments created: $fragmentCount" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Upload failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/8] Triggering Indexing..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    $indexBody = @{ force = $true } | ConvertTo-Json
    $indexResponse = Invoke-RestMethod -Uri "$baseUrl/import/sources/$sourceId/index" -Method Post -Headers $headers -Body $indexBody
    Write-Host "  ✓ Indexing triggered" -ForegroundColor Green
    Write-Host "    Success: $($indexResponse.success)" -ForegroundColor Gray
} catch {
    Write-Host "  ! Indexing error (may complete in background): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/8] Waiting for Indexing to Complete..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
$indexed = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    
    try {
        $source = Invoke-RestMethod -Uri "$baseUrl/import/sources/$sourceId" -Method Get -Headers $headers
        if ($source.status -eq "indexed" -or $source.status -eq "processed") {
            $indexed = $true
            Write-Host "  ✓ Indexing complete (status: $($source.status))" -ForegroundColor Green
            break
        }
    } catch {}
    
    if ($waited % 5 -eq 0) {
        Write-Host "    Still waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
    }
}

if (-not $indexed) {
    Write-Host "  ! Indexing taking longer than expected, continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[6/8] Performing Semantic Search..." -ForegroundColor Yellow
$queries = @(
    "AI and machine learning",
    "frontend technology",
    "database choice"
)

foreach ($query in $queries) {
    Write-Host "  Searching: '$query'" -ForegroundColor Cyan
    try {
        $searchBody = @{
            q = $query
            topK = 3
        } | ConvertTo-Json
        
        $searchResponse = Invoke-RestMethod -Uri "$baseUrl/query" -Method Post -Headers $headers -Body $searchBody
        
        Write-Host "    ✓ Found $($searchResponse.evidence.Count) results" -ForegroundColor Green
        Write-Host "    Summary: $($searchResponse.summary.Substring(0, [Math]::Min(100, $searchResponse.summary.Length)))..." -ForegroundColor Gray
        
        if ($searchResponse.evidence.Count -gt 0) {
            $topResult = $searchResponse.evidence[0]
            Write-Host "    Top match (score: $($topResult.score)): $($topResult.text.Substring(0, [Math]::Min(80, $topResult.text.Length)))..." -ForegroundColor Gray
        }
    } catch {
        Write-Host "    ✗ Search failed: $_" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "[7/8] Building Knowledge Graph..." -ForegroundColor Yellow
try {
    $rebuildResponse = Invoke-RestMethod -Uri "$baseUrl/links/rebuild" -Method Post -Headers $headers -Body "{}"
    Write-Host "  ✓ Links created: $($rebuildResponse.linksCreated)" -ForegroundColor Green
} catch {
    Write-Host "  ! Link building error: $_" -ForegroundColor Yellow
}

try {
    $graphResponse = Invoke-RestMethod -Uri "$baseUrl/graph?limit=50" -Method Get -Headers $headers
    Write-Host "  ✓ Graph nodes: $($graphResponse.nodes.Count)" -ForegroundColor Green
    Write-Host "  ✓ Graph edges: $($graphResponse.edges.Count)" -ForegroundColor Green
} catch {
    Write-Host "  ! Graph retrieval error: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[8/8] System Statistics..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/status" -Method Get -Headers $headers
    Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  Total Fragments: $($stats.counts.fragments)" -ForegroundColor White
    Write-Host "  Total Sources: $($stats.counts.sources)" -ForegroundColor White
    Write-Host "  Total Links: $($stats.totalLinks)" -ForegroundColor White
    Write-Host "  Total Queries: $($stats.counts.queries)" -ForegroundColor White
    Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
} catch {
    Write-Host "  ! Stats retrieval error: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Demo Complete! ✅" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Open http://localhost:3000 to see the UI" -ForegroundColor Gray
Write-Host "  2. Login with: $testEmail / $testPassword" -ForegroundColor Gray
Write-Host "  3. Try uploading more documents" -ForegroundColor Gray
Write-Host "  4. Explore the knowledge graph visualization" -ForegroundColor Gray
Write-Host ""
