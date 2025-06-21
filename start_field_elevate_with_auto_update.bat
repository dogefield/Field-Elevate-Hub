@echo off
title Field-Elevate-Hub with Auto-Update
echo Starting Field-Elevate-Hub with automatic updates...
echo.

cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found in PATH
    echo Please install Python or add it to your PATH
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found in PATH
    echo Please install Node.js to run Field-Elevate-Hub
    pause
    exit /b 1
)

REM Check if this is a Git repository
git status >nul 2>&1
if errorlevel 1 (
    echo Warning: This is not a Git repository
    echo Auto-updates will be disabled
    echo.
)

echo Starting Field-Elevate-Hub with auto-update...
python start_field_elevate_with_auto_update.py

pause 