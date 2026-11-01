# ==============================================================================
# Inspect-DBMS-Data.ps1 (also auto-installs as scripts\inspect_dbms.ps1)
# Bengaluru TransitConnect - Live MySQL 8 DBMS Data Inspector
# Compatible with Windows PowerShell 5.1 & PowerShell 7+ (Zero nested here-strings)
# ==============================================================================

param(
    [string]$Table = "",
    [int]$Limit = 25,
    [switch]$Interactive,
    [switch]$RunVivaQueries
)

$ErrorActionPreference = "Stop"

$ProjectRoot = if ($PSScriptRoot -and (Split-Path -Leaf $PSScriptRoot) -eq "scripts") {
    Split-Path -Parent $PSScriptRoot
} else {
    Join-Path $HOME "BengaluruTransitConnect"
}

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "Project folder not found at $ProjectRoot"
}

# Auto-save a copy into $ProjectRoot\scripts\inspect_dbms.ps1 when run from Downloads
$SelfPath = $MyInvocation.MyCommand.Path
$InstalledScriptPath = Join-Path $ProjectRoot "scripts\inspect_dbms.ps1"
if ($SelfPath -and (Test-Path -LiteralPath $SelfPath)) {
    $ResolvedSelf = (Resolve-Path -LiteralPath $SelfPath).Path
    $ScriptsDir = Join-Path $ProjectRoot "scripts"
    if (-not (Test-Path -LiteralPath $ScriptsDir)) {
        New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
    }
    $NeedCopy = $true
    if (Test-Path -LiteralPath $InstalledScriptPath) {
        $ResolvedDest = (Resolve-Path -LiteralPath $InstalledScriptPath).Path
        if ($ResolvedSelf -ieq $ResolvedDest) {
            $NeedCopy = $false
        }
    }
    if ($NeedCopy) {
        $RawSelf = [System.IO.File]::ReadAllText($ResolvedSelf) -replace "`r`n", "`n"
        [System.IO.File]::WriteAllText($InstalledScriptPath, $RawSelf, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "  [OK] Installed helper to $InstalledScriptPath" -ForegroundColor Green
    }
}

Set-Location -LiteralPath $ProjectRoot

function Find-MySqlExe {
    $cmd = Get-Command mysql -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) {
        return $cmd.Source
    }
    $searchRoots = @(
        "C:\Program Files\MySQL",
        "${env:ProgramFiles(x86)}\MySQL"
    )
    foreach ($root in $searchRoots) {
        if (Test-Path -LiteralPath $root) {
            $dirs = Get-ChildItem -LiteralPath $root -Directory -Filter "MySQL Server*" -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending
            foreach ($d in $dirs) {
                $candidate = Join-Path $d.FullName "bin\mysql.exe"
                if (Test-Path -LiteralPath $candidate) {
                    return $candidate
                }
            }
        }
    }
    return $null
}

$EnvFile = Join-Path $ProjectRoot ".env"
$DbHost = "localhost"
$DbPort = "3306"
$DbName = "bengaluru_transit"
$DbUser = "btc_app"
$DbPass = ""

if (Test-Path -LiteralPath $EnvFile) {
    foreach ($line in (Get-Content -LiteralPath $EnvFile)) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $idx = $trimmed.IndexOf("=")
        if ($idx -lt 1) { continue }
        $k = $trimmed.Substring(0, $idx).Trim()
        $v = $trimmed.Substring($idx + 1).Trim().Trim('"').Trim("'")
        switch ($k) {
            "DB_HOST" { if ($v) { $DbHost = $v } }
            "DB_PORT" { if ($v) { $DbPort = $v } }
            "DB_NAME" { if ($v) { $DbName = $v } }
            "DB_USER" { if ($v) { $DbUser = $v } }
            "DB_PASS" { $DbPass = $v }
        }
    }
}

$MySqlExe = Find-MySqlExe
if (-not $MySqlExe) {
    throw "mysql.exe not found. Run .\scripts\setup_mysql.ps1 first or install MySQL 8."
}

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " Bengaluru TransitConnect - Live MySQL 8 DBMS Data Inspector         " -ForegroundColor Cyan
Write-Host " Host: ${DbHost}:${DbPort} | Database: $DbName | User: $DbUser       " -ForegroundColor Gray
Write-Host "=====================================================================" -ForegroundColor Cyan

$PrevMysqlPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $DbPass

try {
    if ($Interactive) {
        Write-Host ""
        Write-Host "Opening interactive MySQL 8 shell on '$DbName' (type 'exit;' to quit)..." -ForegroundColor Yellow
        & $MySqlExe -h $DbHost -P $DbPort -u $DbUser --default-character-set=utf8mb4 $DbName
        return
    }

    if ($RunVivaQueries) {
        $VivaSqlPath = Join-Path $ProjectRoot "sql\04_viva_demo_queries.sql"
        Write-Host ""
        Write-Host "Running sql\04_viva_demo_queries.sql..." -ForegroundColor Yellow
        Get-Content -LiteralPath $VivaSqlPath -Raw |
            & $MySqlExe -h $DbHost -P $DbPort -u $DbUser --table --default-character-set=utf8mb4 $DbName
        return
    }

    if ($Table) {
        if ($Table -notmatch '^[a-zA-Z0-9_]+$') {
            throw "Invalid table or view name: $Table"
        }
        Write-Host ""
        Write-Host "=== Schema & First $Limit Rows of '$Table' ===" -ForegroundColor Green
        $SingleSqlLines = @(
            "DESCRIBE $Table;",
            "SELECT COUNT(*) AS total_rows_in_$Table FROM $Table;",
            "SELECT * FROM $Table LIMIT $Limit;"
        )
        $SingleSql = $SingleSqlLines -join "`n"
        & $MySqlExe -h $DbHost -P $DbPort -u $DbUser --table --default-character-set=utf8mb4 $DbName -e $SingleSql
        return
    }

    $OverviewSqlLines = @(
        "SELECT '1. ALL 20 NORMALIZED TABLES + 4 VIEWS' AS DBMS_Section;",
        "SHOW FULL TABLES;",
        "SELECT '2. EXACT ROW COUNTS ACROSS CORE TABLES' AS DBMS_Section;",
        "SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users",
        "UNION ALL SELECT 'roles', COUNT(*) FROM roles",
        "UNION ALL SELECT 'passenger_wallets', COUNT(*) FROM passenger_wallets",
        "UNION ALL SELECT 'bus_routes', COUNT(*) FROM bus_routes",
        "UNION ALL SELECT 'bus_stops', COUNT(*) FROM bus_stops",
        "UNION ALL SELECT 'bus_route_stops', COUNT(*) FROM bus_route_stops",
        "UNION ALL SELECT 'buses', COUNT(*) FROM buses",
        "UNION ALL SELECT 'metro_lines', COUNT(*) FROM metro_lines",
        "UNION ALL SELECT 'metro_stations', COUNT(*) FROM metro_stations",
        "UNION ALL SELECT 'metro_connections', COUNT(*) FROM metro_connections",
        "UNION ALL SELECT 'transfer_points', COUNT(*) FROM transfer_points",
        "UNION ALL SELECT 'schedules', COUNT(*) FROM schedules",
        "UNION ALL SELECT 'fare_rules', COUNT(*) FROM fare_rules",
        "UNION ALL SELECT 'city_landmarks', COUNT(*) FROM city_landmarks",
        "UNION ALL SELECT 'journey_plans', COUNT(*) FROM journey_plans",
        "UNION ALL SELECT 'journey_legs', COUNT(*) FROM journey_legs",
        "UNION ALL SELECT 'travel_history', COUNT(*) FROM travel_history",
        "UNION ALL SELECT 'feedback', COUNT(*) FROM feedback",
        "UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;",
        "SELECT '3. USERS & NCMC SMART WALLETS (JOIN)' AS DBMS_Section;",
        "SELECT u.user_id, u.full_name, u.email, pw.smart_card_no, pw.balance_inr FROM users u LEFT JOIN passenger_wallets pw ON pw.user_id = u.user_id ORDER BY u.user_id;",
        "SELECT '4. BOOKED UNIFIED QR PASSES (travel_history JOIN journey_plans)' AS DBMS_Section;",
        "SELECT th.history_id, th.qr_pass_code, jp.source_name, jp.destination_name, th.fare_paid_inr, th.pass_status, th.travelled_at FROM travel_history th INNER JOIN journey_plans jp ON jp.plan_id = th.plan_id ORDER BY th.history_id DESC LIMIT 10;",
        "SELECT '5. 300+ BENGALURU PLACES BY CATEGORY (city_landmarks)' AS DBMS_Section;",
        "SELECT category, COUNT(*) AS total_places FROM city_landmarks GROUP BY category ORDER BY total_places DESC;",
        "SELECT '6. ACTIVE TRIGGERS & STORED PROCEDURES' AS DBMS_Section;",
        "SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();",
        "SELECT ROUTINE_NAME, ROUTINE_TYPE, CREATED FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE();",
        "SELECT '7. RECENT IMMUTABLE TRIGGER AUDIT LOGS (audit_logs)' AS DBMS_Section;",
        "SELECT log_id, operation_type, table_name, record_identifier, created_at FROM audit_logs ORDER BY log_id DESC LIMIT 10;"
    )
    $OverviewSql = $OverviewSqlLines -join "`n"

    & $MySqlExe -h $DbHost -P $DbPort -u $DbUser --table --default-character-set=utf8mb4 $DbName -e $OverviewSql

    Write-Host ""
    Write-Host "Tip: Inspect any single table or open an interactive mysql> shell:" -ForegroundColor Yellow
    Write-Host "  .\scripts\inspect_dbms.ps1 -Table city_landmarks -Limit 20" -ForegroundColor White
    Write-Host "  .\scripts\inspect_dbms.ps1 -Table travel_history" -ForegroundColor White
    Write-Host "  .\scripts\inspect_dbms.ps1 -RunVivaQueries" -ForegroundColor White
    Write-Host "  .\scripts\inspect_dbms.ps1 -Interactive" -ForegroundColor White
} finally {
    $env:MYSQL_PWD = $PrevMysqlPwd
}
