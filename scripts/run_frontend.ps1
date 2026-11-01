# ============================================================================
# scripts/run_frontend.ps1
# Starts Bengaluru TransitConnect React 18 + Vite UI on http://localhost:5173
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRoot = Join-Path $HOME "BengaluruTransitConnect"
$FrontendDir = Join-Path $ProjectRoot "frontend"

if (-not (Test-Path $FrontendDir)) {
    throw "Frontend folder not found at $FrontendDir. Run Phase5-7-React-Leaflet-Frontend.ps1 first."
}

Push-Location $FrontendDir
try {
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        Write-Host "Installing npm packages inside $FrontendDir ..." -ForegroundColor Yellow
        & npm.cmd install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE."
        }
    }

    Write-Host "Starting Bengaluru TransitConnect UI on http://localhost:5173 ..." -ForegroundColor Cyan
    & npm.cmd run dev
} finally {
    Pop-Location
}