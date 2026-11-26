@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Local Student Face Recognition Server (FastAPI + InsightFace)

echo ===================================================================
echo   SMART INCUBATION CENTRE - FACE RECOGNITION BIOMETRIC SERVICE
echo ===================================================================
echo Engine:    InsightFace (buffalo_l on CPU Execution Provider)
echo Database:  attendance.db (SQLite Normalized Embeddings)
echo Privacy:   In-Memory Processing ONLY - Zero Photo/Video Storage
echo Port:      8001 (http://127.0.0.1:8001)
echo Health:    http://127.0.0.1:8001/health
echo ===================================================================
echo.

:: Detect Python executable
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "PY_CMD=py -3"
    ) else (
        if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe" (
            set "PY_CMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
        ) else (
            echo [NOTICE] Python not found in system PATH.
            echo [NOTICE] The main website UI will operate in standard mode without face recognition.
            timeout /t 4 >nul
            exit /b 0
        )
    )
)

:: Verify that the detected Python executable actually runs
%PY_CMD% -c "import sys; sys.exit(0)" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [NOTICE] Python executable is not functioning (Windows Store alias detected).
    echo [NOTICE] The main website UI will operate in standard mode without face recognition.
    echo [NOTICE] To enable Face Recognition later, install standard Python 3.10+ from python.org.
    timeout /t 4 >nul
    exit /b 0
)

echo [1/3] Using Python: %PY_CMD%
%PY_CMD% -c "import sys; print(f'Python version: {sys.version.split()[0]}')"

:: Check required dependencies
echo [2/3] Checking dependencies (FastAPI, Uvicorn, InsightFace, OpenCV, SQLite3)...
%PY_CMD% -c "import fastapi, uvicorn, cv2, insightface, sqlite3; print('[OK] All required packages verified.')"
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Some dependencies may be missing. Installing from requirements.txt...
    %PY_CMD% -m pip install -r requirements.txt
)

:: Start Uvicorn Server on 127.0.0.1:8001
echo [3/3] Starting Face Recognition Server on http://127.0.0.1:8001 ...
echo.
echo ===================================================================
echo   SERVER RUNNING. Keep this window OPEN while using Face Attendance.
echo   Press CTRL+C to stop the service at any time.
echo ===================================================================
echo.

%PY_CMD% -m uvicorn face_server:app --host 127.0.0.1 --port 8001 --reload

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Face Recognition Server stopped unexpectedly with exit code %ERRORLEVEL%.
    pause
)
