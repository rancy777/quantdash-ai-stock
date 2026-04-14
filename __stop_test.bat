@echo off
setlocal
call :kill_port 5173 "Frontend"
exit /b 0
:kill_port
set "PORT=%~1"
set "LABEL=%~2"
setlocal EnableDelayedExpansion
set "FOUND=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  set "FOUND=1"
  echo [INFO] Stopping !LABEL! process on port !PORT! (PID %%P)...
)
if "!FOUND!"=="0" (
  echo [INFO] No !LABEL! process found on port !PORT!.
)
endlocal
exit /b 0
