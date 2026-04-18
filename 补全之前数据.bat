@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title QuantDash Historical Data Backfill

if exist "venv\Scripts\activate.bat" (
  call "venv\Scripts\activate.bat"
)

call :ensure_node
if errorlevel 1 goto :end

call :ensure_python
if errorlevel 1 goto :end

call :ensure_node_modules
if errorlevel 1 goto :end

echo.
echo ==============================
echo QuantDash Historical Backfill
echo ==============================
echo 1. All previous data  ^(sync:offline:py^)
echo 2. Market core        ^(sync:market:py^)
echo 3. Stock snapshots    ^(sync:stocks:py^)
echo 4. Sector snapshots   ^(sync:sectors:py^)
echo 5. Sentiment cycle    ^(sync:cycle:py^)
echo 6. Emotion indicators ^(sync:emotion^)
echo 7. Kline library      ^(sync:kline:py^)
echo.
set /p choice=Select an option [default 1]: 
if "%choice%"=="" set choice=1
set "choice=%choice: =%"

set "script_name="
set "sector_board_types="

if /i "%choice%"=="1" (
  set "script_name=sync:offline:py"
  goto :execute
)
if /i "%choice%"=="2" (
  set "script_name=sync:market:py"
  goto :execute
)
if /i "%choice%"=="3" (
  set "script_name=sync:stocks:py"
  goto :execute
)
if /i "%choice%"=="4" (
  call :choose_sector_board_types
  if errorlevel 1 goto :end
  set "script_name=sync:sectors:py"
  goto :execute
)
if /i "%choice%"=="5" (
  set "script_name=sync:cycle:py"
  goto :execute
)
if /i "%choice%"=="6" (
  set "script_name=sync:emotion"
  goto :execute
)
if /i "%choice%"=="7" (
  set "script_name=sync:kline:py"
  goto :execute
)

echo [ERROR] Invalid option: %choice%
goto :end

:choose_sector_board_types
echo.
echo Select sector board type:
echo 1. All     ^(concept + industry^)
echo 2. Concept
echo 3. Industry
echo.
set /p sector_choice=Select an option [default 1]: 
if "%sector_choice%"=="" set sector_choice=1
set "sector_choice=%sector_choice: =%"

if /i "%sector_choice%"=="1" (
  set "sector_board_types=concept,industry"
  exit /b 0
)
if /i "%sector_choice%"=="2" (
  set "sector_board_types=concept"
  exit /b 0
)
if /i "%sector_choice%"=="3" (
  set "sector_board_types=industry"
  exit /b 0
)

echo [ERROR] Invalid sector option: %sector_choice%
exit /b 1

:execute
if defined sector_board_types (
  set "SECTOR_BOARD_TYPES=%sector_board_types%"
  echo.
  echo [INFO] Sector board types: %SECTOR_BOARD_TYPES%
) else (
  set "SECTOR_BOARD_TYPES="
)

echo.
echo [INFO] Running npm run %script_name%
npm run %script_name%
if not errorlevel 1 goto :success

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm run %script_name% failed and pnpm was not found for fallback.
  goto :end
)

echo [WARN] npm run %script_name% failed. Retrying with pnpm...
pnpm run %script_name%
if errorlevel 1 (
  echo [ERROR] pnpm run %script_name% failed too.
  goto :end
)
goto :success

:success
echo.
echo [INFO] Historical data sync finished.
goto :end

:ensure_node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install it and add it to PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Check the Node.js installation.
  exit /b 1
)

exit /b 0

:ensure_python
where python >nul 2>nul
if not errorlevel 1 exit /b 0

where py >nul 2>nul
if not errorlevel 1 exit /b 0

echo [ERROR] Python was not found. Install Python 3 or use the project venv.
exit /b 1

:ensure_node_modules
if exist "node_modules" exit /b 0

echo [INFO] node_modules was not found. Installing dependencies...
npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  exit /b 1
)

exit /b 0

:end
echo.
pause
