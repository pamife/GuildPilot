@echo off
title 🛸 GuildPilot - Discord Server Manager
cd /d "%~dp0"
mode con cols=95 lines=32

powershell -NoProfile -ExecutionPolicy Bypass -Command "^
$Host.UI.RawUI.ForegroundColor = 'Cyan'; ^
Write-Host '   ______ _____  ____   ____ ___     ____   ____ _     ____ _____ ' -ForegroundColor Cyan; ^
Write-Host '  / ___// / / / /  _/  / __// _ \   / __ \ /  _/ /    / __//_  _/ ' -ForegroundColor Cyan; ^
Write-Host ' / (_ // /_/ / _/ /   / _/ / ___/  / /_/ /_/ // /___ / _/   / /   ' -ForegroundColor BrightCyan; ^
Write-Host ' \___/ \____/ /___/  /___//_/     / .___//___/_____//___/  /_/    ' -ForegroundColor BrightCyan; ^
Write-Host '                                  /_/                             ' -ForegroundColor Magenta; ^
Write-Host ' ================================================================' -ForegroundColor DarkGray; ^
Write-Host '      Local-Only Discord Server Management & Dashboard           ' -ForegroundColor Yellow; ^
Write-Host ' ================================================================' -ForegroundColor DarkGray; ^
Write-Host ''; ^
function Spinner($msg, $scriptBlock) { ^
    $spin = @('|', '/', '-', '\'); ^
    $job = Start-Job -ScriptBlock $scriptBlock; ^
    $i = 0; ^
    while ($job.State -eq 'Running') { ^
        Write-Host ('`r[' + $spin[$i % 4] + '] ' + $msg + '...') -NoNewline -ForegroundColor Yellow; ^
        Start-Sleep -Milliseconds 120; ^
        $i++; ^
    } ^
    $res = Receive-Job $job; ^
    Remove-Job $job; ^
    Write-Host ('`r[v] ' + $msg + ' Done!     ') -ForegroundColor Green; ^
}; ^
if (-not (Test-Path '.env')) { ^
    Copy-Item '.env.example' '.env'; ^
    Write-Host '[!] Created .env file. Remember to add your DISCORD_TOKEN!' -ForegroundColor Magenta; ^
}; ^
if (-not (Test-Path 'node_modules')) { ^
    Spinner 'Installing dependencies (npm install)' { Set-Location '$PWD'; npm install | Out-Null }; ^
}; ^
if (-not (Test-Path 'dev.db')) { ^
    Spinner 'Initializing SQLite database (Prisma db push)' { Set-Location '$PWD'; npx prisma@5.15.0 db push | Out-Null }; ^
}; ^
Write-Host ''; ^
Write-Host ' +-------------------------------------------------------------+' -ForegroundColor DarkCyan; ^
Write-Host ' | [v] Web Dashboard : http://localhost:3000                   |' -ForegroundColor Green; ^
Write-Host ' | [v] Express API   : http://localhost:3001                   |' -ForegroundColor Green; ^
Write-Host ' | [*] Realtime Sync : Socket.IO Active                        |' -ForegroundColor BrightYellow; ^
Write-Host ' +-------------------------------------------------------------+' -ForegroundColor DarkCyan; ^
Write-Host ''; ^
Write-Host '[*] Launching Web Dashboard in your browser...' -ForegroundColor Cyan; ^
Start-Process 'http://localhost:3000'; ^
Write-Host '[*] Starting GuildPilot Engine (Press Ctrl+C to stop)...' -ForegroundColor Magenta; ^
Write-Host ''
"

npm run dev
pause
