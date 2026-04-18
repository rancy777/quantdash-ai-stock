@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title QuantDash Single-Day Snapshot Export

if exist "venv\Scripts\activate.bat" (
  call "venv\Scripts\activate.bat"
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install it and add it to PATH.
  goto :end
)

echo.
echo ==============================
echo QuantDash Single-Day Snapshot
echo ==============================
set /p target_date=Input trading date ^(YYYY-MM-DD^): 
set "target_date=%target_date: =%"

if "%target_date%"=="" (
  echo [ERROR] Date is required.
  goto :end
)

echo.
echo [INFO] Exporting single-day project snapshot for %target_date%
node scripts\exportSingleDayProjectData.js %target_date%
if errorlevel 1 (
  echo [ERROR] Single-day snapshot export failed.
  goto :end
)

echo.
echo [INFO] Output saved under data\single_day_snapshots\%target_date%.json

:end
echo.
pause
