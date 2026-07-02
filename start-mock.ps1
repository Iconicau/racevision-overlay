# RaceVision -- Dev launcher (mock telemetry, no iRacing needed)
# Run: .\start-mock.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Starting RaceVision (mock mode)..." -ForegroundColor Magenta

# Backend with USE_MOCK=true
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root'; `$host.UI.RawUI.WindowTitle = 'RV Backend [MOCK]'; Write-Host '=== RaceVision Backend [MOCK] ===' -ForegroundColor Magenta; `$env:USE_MOCK='true'; python -m backend.main"
)

# Frontend
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root\frontend'; `$host.UI.RawUI.WindowTitle = 'RV Frontend'; Write-Host '=== RaceVision Frontend ===' -ForegroundColor Green; npm run dev"
)

# Electron -- wait 4s so backend + frontend are ready
Start-Sleep -Seconds 4
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root'; `$host.UI.RawUI.WindowTitle = 'RV Electron'; Write-Host '=== RaceVision Electron ===' -ForegroundColor Yellow; npm start"
)

Write-Host "All three processes launched (mock mode - no iRacing required)." -ForegroundColor Magenta
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor DarkGray
Write-Host "Frontend: http://localhost:5173" -ForegroundColor DarkGray
