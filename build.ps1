$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== RaceVision Overlay -- Release Build ===" -ForegroundColor Cyan
Write-Host ""

# -- Prerequisites check --
$missing = @()
if (-not (Get-Command python -ErrorAction SilentlyContinue))   { $missing += "Python" }
if (-not (Get-Command node   -ErrorAction SilentlyContinue))   { $missing += "Node.js" }
if (-not (Get-Command npm    -ErrorAction SilentlyContinue))   { $missing += "npm" }
if ($missing.Count -gt 0) {
    Write-Error "Missing: $($missing -join ', '). Install them and re-run."
    exit 1
}

try { python -c "import PyInstaller" } catch {
    Write-Error "PyInstaller not installed. Run: pip install pyinstaller"
    exit 1
}

# -- Step 1: Frontend --
Write-Host "[1/3] Building frontend (Vite)..." -ForegroundColor Yellow
Set-Location frontend
npm install --silent
npm run build
if (-not $?) { Write-Error "Frontend build failed"; exit 1 }
Set-Location ..
Write-Host "      Frontend done." -ForegroundColor Green

# -- Step 2: Backend (PyInstaller) --
Write-Host "[2/3] Packaging backend (PyInstaller)..." -ForegroundColor Yellow
if (Test-Path backend-dist) { Remove-Item backend-dist -Recurse -Force }
if (Test-Path build-tmp)    { Remove-Item build-tmp    -Recurse -Force }
python -m PyInstaller build.spec --distpath backend-dist --workpath build-tmp --noconfirm --clean
if (-not $?) { Write-Error "PyInstaller failed"; exit 1 }
Write-Host "      Backend done." -ForegroundColor Green

# -- Step 3: Electron installer --
Write-Host "[3/3] Building Windows installer (electron-builder)..." -ForegroundColor Yellow
if (-not (Test-Path node_modules)) { npm install --silent }
npx electron-builder build --win
if (-not $?) { Write-Error "electron-builder failed"; exit 1 }
Write-Host "      Installer done." -ForegroundColor Green

Write-Host ""
Write-Host "=== Build complete! ===" -ForegroundColor Cyan
Write-Host "Installer is in: release\RaceVision Overlay Setup 0.1.0.exe" -ForegroundColor White
Write-Host ""
