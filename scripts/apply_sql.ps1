# scripts/apply_sql.ps1
# Executes Phase 3 MySQL 8 DDL, Views, Triggers, Stored Procedures & Bengaluru Seed Data,
# then runs a live verification summary against 'bengaluru_transit'.

$ErrorActionPreference = "Continue"

$ProjectRoot = if ($PSScriptRoot -and (Split-Path -Leaf $PSScriptRoot) -eq "scripts") {
    Split-Path -Parent $PSScriptRoot
} else {
    Join-Path $HOME "BengaluruTransitConnect"
}
Set-Location -LiteralPath $ProjectRoot

$EnvFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path -LiteralPath $EnvFile)) {
    $SetupScript = Join-Path $ProjectRoot "scripts\setup_mysql.ps1"
    if (Test-Path -LiteralPath $SetupScript) {
        Write-Host "  .env not found yet - running setup_mysql.ps1 first..." -ForegroundColor Yellow
        & "$SetupScript"
    } else {
        Write-Host "[ERROR] .env not found. Run Phase 1-2 setup_mysql.ps1 first." -ForegroundColor Red
        return
    }
}

$DbName = "bengaluru_transit"
$DbUser = "btc_app"
$DbPass = $null

foreach ($line in (Get-Content -LiteralPath $EnvFile)) {
    if ($line -match "^DB_NAME=(.+)$") { $DbName = $Matches[1].Trim() }
    if ($line -match "^DB_USER=(.+)$") { $DbUser = $Matches[1].Trim() }
    if ($line -match "^DB_PASS=(.+)$") { $DbPass = $Matches[1].Trim() }
}

if (-not $DbPass) {
    Write-Host "[ERROR] DB_PASS missing in .env. Re-run .\\scripts\\setup_mysql.ps1" -ForegroundColor Red
    return
}

function Resolve-MySqlExe {
    $cmd = Get-Command mysql -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) { return $cmd.Source }
    foreach ($root in @("C:\Program Files\MySQL", "${env:ProgramFiles(x86)}\MySQL")) {
        if (Test-Path -LiteralPath $root) {
            $dirs = Get-ChildItem -LiteralPath $root -Directory -Filter "MySQL Server*" -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending
            foreach ($d in $dirs) {
                $cand = Join-Path $d.FullName "bin\mysql.exe"
                if (Test-Path -LiteralPath $cand) { return $cand }
            }
        }
    }
    return $null
}

$MySqlExe = Resolve-MySqlExe
if (-not $MySqlExe) {
    Write-Host "[ERROR] mysql.exe not found. Run .\\scripts\\setup_mysql.ps1 in Administrator PowerShell first." -ForegroundColor Red
    return
}

$SqlScripts = @(
    "sql\01_schema.sql",
    "sql\02_views_triggers_procs.sql",
    "sql\03_seed_bengaluru_data.sql"
)

$env:MYSQL_PWD = $DbPass
try {
    foreach ($relSql in $SqlScripts) {
        $fullSql = Join-Path $ProjectRoot $relSql
        Write-Host "=== Executing $relSql ===" -ForegroundColor Cyan
        $sqlText = [System.IO.File]::ReadAllText($fullSql, [System.Text.Encoding]::UTF8)
        $sqlText | & "$MySqlExe" --default-character-set=utf8mb4 -u "$DbUser" -D "$DbName"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed executing $relSql (exit code $LASTEXITCODE)." -ForegroundColor Red
            return
        }
        Write-Host "  [OK] $relSql applied cleanly." -ForegroundColor Green
    }

    Write-Host "`n=== Phase 3 Database Verification Summary ===" -ForegroundColor Cyan
    $VerifyQuery = @(
        "SELECT",
        "  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DbName' AND table_type = 'BASE TABLE') AS base_tables_20,",
        "  (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = '$DbName') AS sql_views_4,",
        "  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$DbName') AS triggers_5,",
        "  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '$DbName') AS stored_procs_3,",
        "  (SELECT COUNT(*) FROM metro_stations) AS metro_stations_31,",
        "  (SELECT COUNT(*) FROM bus_stops) AS bmtc_stops_45,",
        "  (SELECT COUNT(*) FROM bus_routes) AS bmtc_routes_13,",
        "  (SELECT COUNT(*) FROM transfer_points) AS transfer_hubs_15,",
        "  (SELECT COUNT(*) FROM city_landmarks) AS landmarks_50,",
        "  (SELECT COUNT(*) FROM audit_logs) AS trigger_audit_rows;",
        "CALL sp_find_nearby_transit_nodes(12.917200, 77.622800, 1.50, 4);"
    ) -join " "

    & "$MySqlExe" --table -u "$DbUser" -D "$DbName" -e "$VerifyQuery"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[SUCCESS] Phase 3 MySQL 8 Database Implementation is LIVE and VERIFIED!" -ForegroundColor Green
        Write-Host "  Run Viva Demo Queries anytime with:" -ForegroundColor Yellow
        Write-Host "    Get-Content .\\sql\\04_viva_demo_queries.sql -Raw | mysql -u $DbUser -p $DbName --table" -ForegroundColor Cyan
    }
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}