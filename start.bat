@echo off
chcp 65001 >nul
title Bloxorz Runner
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Qua trinh khoi dong that bai hoac da bi dung.
    pause
)
