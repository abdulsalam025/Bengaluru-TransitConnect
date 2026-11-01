# ============================================================================
# scripts/run_backend.ps1
# Starts Bengaluru TransitConnect Spring Boot REST API on http://localhost:8080
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRoot = Join-Path $HOME "BengaluruTransitConnect"
$BackendDir  = Join-Path $ProjectRoot "backend"
$EnvFile     = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $BackendDir)) {
    throw "Backend folder not found at $BackendDir."
}

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
    Write-Host "[OK] Loaded environment configuration from $EnvFile" -ForegroundColor Green
}

if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    $propLines = cmd /c "java -XshowSettings:properties -version 2>&1"
    foreach ($p in $propLines) {
        if ($p -match "java\.home\s*=\s*(.+)$") {
            $env:JAVA_HOME = $Matches[1].Trim()
            break
        }
    }
}

$Port = if ($env:SERVER_PORT) { $env:SERVER_PORT } else { "8080" }

$ExistingListeners = Get-NetTCPConnection -LocalPort ([int]$Port) -State Listen -ErrorAction SilentlyContinue
if ($ExistingListeners) {
    $Pids = $ExistingListeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($ProcId in $Pids) {
        $Proc = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
        $ProcName = if ($Proc) { $Proc.ProcessName } else { "Unknown" }
        $Reply = Read-Host "Port $Port is already in use by $ProcName (PID $ProcId). Stop it and restart backend? [Y/n]"
        if ($Reply -eq "" -or $Reply -match "^[Yy]") {
            Stop-Process -Id $ProcId -Force
            Start-Sleep -Seconds 2
            Write-Host "[OK] Stopped old $ProcName process (PID $ProcId) on port $Port." -ForegroundColor Green
        } else {
            throw "Aborted because port $Port is still in use."
        }
    }
}

Write-Host "Starting Bengaluru TransitConnect API on http://localhost:$Port ..." -ForegroundColor Cyan
Write-Host "Health check URL: http://localhost:$Port/api/health (Press Ctrl+C to stop)" -ForegroundColor Yellow

Push-Location $BackendDir
try {
    & .\mvnw.cmd spring-boot:run
} finally {
    Pop-Location
}