@echo off
setlocal enabledelayedexpansion
title Smart Lab - 3x3 Zone & Gesture Real-Time Calibration
cd /d "%~dp0"

echo ===================================================================
echo   SMART LAB - 3x3 ZONE & HAND GESTURE REAL-TIME CALIBRATION
echo ===================================================================
echo Mode:       Calibration & Visual HUD (Safe: Physical relays disabled)
echo Telemetry:  http://127.0.0.1:8002/api/zone-telemetry
echo Frontend:   Open http://localhost:5173/admin/control to view UI
echo Controls:   Press 'q' in OpenCV window to stop
echo ===================================================================
echo.

python hardware\zone_gesture_controller.py %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Python execution failed. Check dependencies or camera connection.
    pause
)
