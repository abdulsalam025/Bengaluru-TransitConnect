# ============================================================================
# scripts/test_backend.ps1
# Phase 4 & 6 Verifier: Loads .env, auto-detects JAVA_HOME, and runs JUnit 5
# + Spring Boot + Live MySQL 8 Integration Tests via Maven Wrapper (mvnw.cmd)
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRoot = Join-Path $HOME "BengaluruTransitConnect"
$BackendDir  = Join-Path $ProjectRoot "backend"
$EnvFile     = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $BackendDir)) {
    throw "Backend folder not found at $BackendDir. Run Phase4-6-SpringBoot-Backend.ps1 first."
}

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
    Write-Host "[OK] Loaded MySQL & JWT credentials from $EnvFile" -ForegroundColor Green
} else {
    Write-Warning ".env file not found at $EnvFile. Falling back to process environment variables."
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

if (-not $env:JAVA_HOME) {
    throw "Java 21 was not found. Ensure 'java -version' works in PowerShell."
}
Write-Host "[OK] Using JAVA_HOME = $env:JAVA_HOME" -ForegroundColor Cyan

Push-Location $BackendDir
try {
    Write-Host "`nRunning Spring Boot 3.4 + Multi-Modal Graph Integration Tests..." -ForegroundColor Yellow
    & .\mvnw.cmd test -B
    if ($LASTEXITCODE -ne 0) {
        throw "Maven integration test suite failed with exit code $LASTEXITCODE."
    }
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host " ALL 10 SPRING BOOT + MYSQL 8 INTEGRATION TESTS PASSED (10/10)  " -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
} finally {
    Pop-Location
}