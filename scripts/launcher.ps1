# GuildPilot Animated PowerShell Launcher Script
$Host.UI.RawUI.WindowTitle = "GuildPilot - Discord Server Manager"

Clear-Host

Write-Host "   ______ _____  ____   ____ ___     ____   ____ _     ____ _____ " -ForegroundColor Cyan
Write-Host "  / ___// / / / /  _/  / __// _ \   / __ \ /  _/ /    / __//_  _/ " -ForegroundColor Cyan
Write-Host " / (_ // /_/ / _/ /   / _/ / ___/  / /_/ /_/ // /___ / _/   / /   " -ForegroundColor BrightCyan
Write-Host " \___/ \____/ /___/  /___//_/     / .___//___/_____//___/  /_/    " -ForegroundColor BrightCyan
Write-Host "                                  /_/                             " -ForegroundColor Magenta
Write-Host " ================================================================" -ForegroundColor DarkGray
Write-Host "      Local-Only Discord Server Management & Dashboard           " -ForegroundColor Yellow
Write-Host " ================================================================" -ForegroundColor DarkGray
Write-Host ""

# Check .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[!] Created .env file from template. Please configure DISCORD_TOKEN in .env!" -ForegroundColor Magenta
}

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing Node.js dependencies (npm install)..." -ForegroundColor Yellow
    npm install
}

# Check SQLite Database
if (-not (Test-Path "dev.db")) {
    Write-Host "[*] Initializing SQLite database dev.db (Prisma db push)..." -ForegroundColor Yellow
    npx prisma@5.15.0 db push
}

Write-Host ""
Write-Host " +-------------------------------------------------------------+" -ForegroundColor DarkCyan
Write-Host " | [v] Web Dashboard : http://localhost:3000                   |" -ForegroundColor Green
Write-Host " | [v] Express API   : http://localhost:3001                   |" -ForegroundColor Green
Write-Host " | [*] Realtime Sync : Socket.IO Active                        |" -ForegroundColor Yellow
Write-Host " +-------------------------------------------------------------+" -ForegroundColor DarkCyan
Write-Host ""

Write-Host "[*] Opening Web Dashboard in default browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host "[*] Starting GuildPilot Engine (Press Ctrl+C to stop)..." -ForegroundColor Magenta
Write-Host ""

npm run dev
