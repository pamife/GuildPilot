@echo off
title GuildPilot - Local Discord Server Management
cd /d "%~dp0"

echo ===================================================
echo 🛸 GuildPilot - Personal Local Server Manager
echo ===================================================
echo.

REM 1. Check for .env file
if not exist ".env" (
    echo [!] .env file not found. Copying from .env.example...
    copy ".env.example" ".env" >nul
    echo [!] Created .env file. Please edit .env with your DISCORD_TOKEN and ALLOWED_USER_ID!
    echo.
)

REM 2. Check for node_modules
if not exist "node_modules\" (
    echo [*] Installing dependencies...
    call npm install
    echo.
)

REM 3. Check for SQLite Database
if not exist "dev.db" (
    echo [*] Initializing SQLite database dev.db with Prisma...
    call npx prisma db push
    echo.
)

echo [*] Starting GuildPilot Local Backend ^& Next.js Web Dashboard...
echo [*] Dashboard URL: http://localhost:3000
echo [*] Press Ctrl+C to stop the application.
echo.

npm run dev

pause
