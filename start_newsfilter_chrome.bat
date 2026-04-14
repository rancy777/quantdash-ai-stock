@echo off
setlocal

set "CHROME_EXE="

for /f "delims=" %%I in ('where chrome.exe 2^>nul') do (
  if not defined CHROME_EXE set "CHROME_EXE=%%I"
)

if not defined CHROME_EXE (
  for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find /i "REG_SZ"') do (
    if not defined CHROME_EXE set "CHROME_EXE=%%B"
  )
)

if not defined CHROME_EXE (
  for /f "tokens=2,*" %%A in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find /i "REG_SZ"') do (
    if not defined CHROME_EXE set "CHROME_EXE=%%B"
  )
)

if not defined CHROME_EXE (
  echo [ERROR] 未找到 Chrome，无法启动 NewsFilter 所需的远程调试浏览器。
  echo [ERROR] 前端和后端仍可正常启动，但 NewsFilter 这一路新闻抓取不会工作。
  echo [ERROR] 请先安装 Chrome，或手动修改本文件中的 CHROME_EXE 路径。
  pause
  exit /b 1
)

set "DEBUG_PORT=19223"
set "PROFILE_DIR=%TEMP%\quantdash-newsfilter-chrome"

echo 正在启动 Chrome 远程调试实例...
echo Chrome: "%CHROME_EXE%"
echo Port: %DEBUG_PORT%
echo Profile: "%PROFILE_DIR%"
echo.
echo 启动后可访问 http://127.0.0.1:%DEBUG_PORT%/json/version 检查端口是否可用
echo.

start "" "%CHROME_EXE%" --remote-debugging-port=%DEBUG_PORT% --user-data-dir="%PROFILE_DIR%"

endlocal
