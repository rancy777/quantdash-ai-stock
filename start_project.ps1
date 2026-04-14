$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

$activatePath = Join-Path $PSScriptRoot "venv\Scripts\activate.bat"
if (Test-Path $activatePath) {
  cmd /c "`"$activatePath`""
}

Write-Host ""
Write-Host "[INFO] Project root: $PSScriptRoot"
Write-Host "[INFO] Python:"
python --version
Write-Host "[INFO] Node:"
node --version
Write-Host "[INFO] NPM:"
npm --version
Write-Host ""

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "[INFO] node_modules not found, installing dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed."
  }
}

Write-Host "[INFO] Clearing existing frontend/backend ports..."
& (Join-Path $PSScriptRoot "stop_project.bat")

Write-Host "[INFO] Starting backend on http://127.0.0.1:7878 ..."
Start-Process -FilePath "cmd.exe" -WorkingDirectory $PSScriptRoot -ArgumentList "/k", "if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat && python scripts\screener_service.py"

Write-Host "[INFO] Starting frontend dev server..."
Start-Process -FilePath "cmd.exe" -WorkingDirectory $PSScriptRoot -ArgumentList "/k", "if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat && npm run dev"

$newsScriptDir = Join-Path $PSScriptRoot "dingding盘中资讯2\dingding盘中资讯"
$startExternalNewsValue = ""
if ($null -ne $env:START_EXTERNAL_NEWS) {
  $startExternalNewsValue = "$env:START_EXTERNAL_NEWS".Trim()
}
$startExternalNews = ($startExternalNewsValue -eq "1")

if ($startExternalNews) {
  $newsfilterChromeLauncher = Join-Path $PSScriptRoot "start_newsfilter_chrome.bat"
  if (Test-Path $newsfilterChromeLauncher) {
    Write-Host "[INFO] START_EXTERNAL_NEWS=1, starting NewsFilter Chrome debug instance on port 19223 ..."
    Start-Process -FilePath "cmd.exe" -WorkingDirectory $PSScriptRoot -ArgumentList "/c", "`"$newsfilterChromeLauncher`""
    Start-Sleep -Milliseconds 1200
    try {
      $null = Invoke-WebRequest -Uri "http://127.0.0.1:19223/json/version" -UseBasicParsing -TimeoutSec 3
      Write-Host "[INFO] NewsFilter Chrome debug port is ready."
    } catch {
      Write-Host "[WARN] Chrome debug port 19223 is not reachable. NewsFilter capture may fail."
      Write-Host "[WARN] Check whether Chrome is installed and whether start_newsfilter_chrome.bat launched successfully."
    }
  } else {
    Write-Host "[WARN] NewsFilter Chrome launcher not found: $newsfilterChromeLauncher"
  }
}
else {
  Write-Host "[INFO] External NewsFilter collection is disabled by default."
  Write-Host "[INFO] Only CLS news collector will be started. Set START_EXTERNAL_NEWS=1 to re-enable NewsFilter."
}

$clsNewsRunner = Join-Path $newsScriptDir "cls_telegraph_to_dingtalk_single.py"
$newsRunner = if ($startExternalNews) { Join-Path $newsScriptDir "run_both.py" } else { $clsNewsRunner }

if (Test-Path $newsRunner) {
  if ($startExternalNews) {
    Write-Host "[INFO] Starting news collectors (CLS + External)..."
    Start-Process -FilePath "cmd.exe" -WorkingDirectory $newsScriptDir -ArgumentList "/k", "if exist `"$PSScriptRoot\venv\Scripts\activate.bat`" call `"$PSScriptRoot\venv\Scripts\activate.bat`" && python run_both.py"
  } else {
    Write-Host "[INFO] Starting CLS news collector only..."
    Start-Process -FilePath "cmd.exe" -WorkingDirectory $newsScriptDir -ArgumentList "/k", "if exist `"$PSScriptRoot\venv\Scripts\activate.bat`" call `"$PSScriptRoot\venv\Scripts\activate.bat`" && python cls_telegraph_to_dingtalk_single.py"
  }
} else {
  Write-Host "[WARN] News collector script not found: $newsRunner"
}

Write-Host ""
Write-Host "[INFO] Frontend, backend, and news collectors have been started in separate windows."
Write-Host "[INFO] Frontend: http://localhost:5173"
Write-Host "[INFO] Backend:  http://127.0.0.1:7878"
