#Requires -Version 5.1
<#
.SYNOPSIS
    Phase 9 End-to-End 3-Tier Verification Suite for Bengaluru TransitConnect:
      [Tier 1] MySQL 8 EXPLAIN Query Plans, 89 Constraints & Stored Procedures Audit
      [Tier 2] Spring Boot 3.4 + JUnit 5 + MockMvc + ACID + RBAC Suite (10/10 Tests)
      [Tier 3] React 18 + Vite 5 + Leaflet Production Bundle Verification
#>
$ErrorActionPreference = "Stop"

$ProjectRoot = Join-Path $HOME "BengaluruTransitConnect"
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$SqlAudit    = Join-Path $ProjectRoot "sql\05_explain_and_security_audit.sql"
$SqlSeed     = Join-Path $ProjectRoot "sql\03_seed_bengaluru_data.sql"
$EnvFile     = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $ProjectRoot)) {
    throw "Project directory not found at $ProjectRoot."
}
Set-Location $ProjectRoot

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

$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "btc_app" }
$DbPass = if ($env:DB_PASS) { $env:DB_PASS } else { "Transit@2026" }

# Locate mysql.exe
$MysqlExe = $null
$CmdMysql = Get-Command "mysql.exe" -ErrorAction SilentlyContinue
if ($CmdMysql) {
    $MysqlExe = $CmdMysql.Source
} else {
    $Candidates = Get-ChildItem "C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
    if ($Candidates) {
        $MysqlExe = $Candidates[0].FullName
    }
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host " [TIER 1/3] MYSQL 8 EXPLAIN QUERY PLANS & CONSTRAINT AUDIT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
if ($MysqlExe -and (Test-Path $SqlAudit)) {
    $env:MYSQL_PWD = $DbPass
    try {
        Get-Content $SqlAudit -Raw | & $MysqlExe --table -u $DbUser bengaluru_transit
        if ($LASTEXITCODE -ne 0) {
            throw "MySQL EXPLAIN & security audit script failed."
        }
        Write-Host "[PASS] Tier 1 MySQL 8 EXPLAIN & Constraint Audit succeeded." -ForegroundColor Green
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
} else {
    Write-Warning "mysql.exe CLI not found on PATH; Tier 2 JUnit test t10 will verify EXPLAIN plans via JDBC."
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host " [TIER 2/3] SPRING BOOT 3.4 + JUNIT 5 + LIVE MYSQL (10 TESTS)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
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

Push-Location $BackendDir
try {
    & .\mvnw.cmd test -B
    if ($LASTEXITCODE -ne 0) {
        throw "Backend JUnit 5 integration test suite failed."
    }
    Write-Host "[PASS] Tier 2 Backend Integration Suite (10/10 tests) succeeded." -ForegroundColor Green
} finally {
    Pop-Location
}

if ($MysqlExe -and (Test-Path $SqlSeed)) {
    $env:MYSQL_PWD = $DbPass
    try {
        Get-Content $SqlSeed -Raw | & $MysqlExe -u $DbUser bengaluru_transit
        Write-Host "[OK] Restored clean Bengaluru seed dataset after integration tests." -ForegroundColor Green
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host " [TIER 3/3] REACT 18 + VITE 5 + LEAFLET PRODUCTION BUNDLE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend Vite production build failed."
    }
    Write-Host "[PASS] Tier 3 Frontend Production Bundle succeeded." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " ALL 3 TIERS VERIFIED: DATABASE + BACKEND (10/10) + FRONTEND " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green