# ============================================================================
# scripts/start_all.ps1
# 1-Command Full-Stack Launcher: Starts Spring Boot (:8080) if not running,
# waits for /api/health UP, opens http://localhost:5173, and runs Vite (:5173)
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRoot   = Join-Path $HOME "BengaluruTransitConnect"
$BackendScript = Join-Path $ProjectRoot "scripts\run_backend.ps1"
$FrontendScript= Join-Path $ProjectRoot "scripts\run_frontend.ps1"

function Test-BackendReady {
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 2 -ErrorAction Stop
        return ($resp.status -eq "UP")
    } catch {
        return $false
    }
}

if (Test-BackendReady) {
    Write-Host "[OK] Spring Boot API is already running on http://localhost:8080" -ForegroundColor Green
} else {
    Write-Host "Launching Spring Boot Backend (:8080) in a background PowerShell window..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$BackendScript`""

    Write-Host "Waiting for Spring Boot + MySQL 8 health endpoint (http://localhost:8080/api/health)..." -ForegroundColor Cyan
    $ready = $false
    for ($i = 1; $i -le 45; $i++) {
        Start-Sleep -Seconds 2
        if (Test-BackendReady) {
            $ready = $true
            break
        }
        Write-Host "  ... waiting ($($i * 2)s)" -ForegroundColor DarkGray
    }
    if (-not $ready) {
        Write-Warning "Backend is still compiling/starting in the second window. Proceeding to launch Frontend..."
    } else {
        Write-Host "[OK] Spring Boot + MySQL 8 API is UP on http://localhost:8080!" -ForegroundColor Green
    }
}

Start-Process "http://localhost:5173"
& $FrontendScript