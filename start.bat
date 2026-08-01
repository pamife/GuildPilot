@echo off
title GuildPilot - Local Discord Server Manager
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Launcher exited with error code %ERRORLEVEL%.
)

echo.
echo Press any key to exit...
pause
