# PowerShell MongoDB backup script for EchoLink
# Usage: .\backup_mongo.ps1 <BackupDir>

param(
  [string]$BackupDir = "./mongo_backups"
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dbName = "echolink"

if (!(Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$backupPath = Join-Path $BackupDir $timestamp

Write-Host "Backing up MongoDB database '$dbName' to $backupPath"

$cmd = "mongodump --db $dbName --out $backupPath"
Invoke-Expression $cmd

if ($LASTEXITCODE -eq 0) {
  Write-Host "Backup successful: $backupPath"
} else {
  Write-Error "Backup failed"
  exit 1
}
