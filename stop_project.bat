@echo off
setlocal

cd /d "%~dp0"

call :kill_port 5173 "Frontend"
call :kill_port 7878 "Backend"

echo.
echo [INFO] Stop check completed.
exit /b 0

:kill_port
set "PORT=%~1"
set "LABEL=%~2"
setlocal

for /f %%P in ('powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { $pids | ForEach-Object { Write-Output $_ } }"') do (
  echo [INFO] Stopping %LABEL% process on port %PORT%, PID %%P ...
  taskkill /PID %%P /F >nul 2>&1
)

powershell -NoProfile -Command "$exists = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue; if (-not $exists) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo [WARN] %LABEL% port %PORT% is still in use.
) else (
  echo [INFO] %LABEL% port %PORT% is clear.
)

endlocal
exit /b 0
