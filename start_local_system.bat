@echo off
setlocal
cd /d "%~dp0"
title Smart Incubation Management System - One-Click Launcher

echo ===================================================================
echo   SMART INCUBATION CENTRE - LOCAL SYSTEM ONE-CLICK LAUNCHER
echo ===================================================================
echo.
echo [1/2] Launching Local Face Recognition Biometric Service (Port 8001)...
start "Face Recognition Biometric Server (Port 8001)" cmd /k "cd /d "%~dp0\backend\face" && call start_face_server.bat"

echo Waiting 3 seconds for Face Engine initialization...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Launching Frontend Development Website (Port 5173)...
echo.
echo ===================================================================
echo   SERVICES STARTING:
echo   - Face Service:  http://127.0.0.1:8001/health
echo   - Website UI:    http://localhost:5173
echo ===================================================================
echo.

npm run dev
