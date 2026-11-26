@echo off
title Smart Lab - Camera 3x3 Grid Monitor
cd /d "%~dp0"

echo ===================================================================
echo   SMART LAB - CAMERA 3x3 GRID OCCUPANCY ^& RELAY MONITOR
echo ===================================================================
echo Script: hardware\code.py
echo Grid:   3x3 Uniform Grid (G1-G9)
echo Relays: G1 -^> Relay 1 (GPIO 22), G2 -^> Relay 2 (GPIO 23)
echo Controls: Press 'q' in camera window to quit.
echo ===================================================================
echo.

python hardware\code.py %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Execution failed. Ensure Python, OpenCV, Ultralytics, and PySerial are installed.
    pause
)
