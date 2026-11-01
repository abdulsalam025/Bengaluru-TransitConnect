# scripts/setup_mysql.ps1
# Detects or installs MySQL 8.x on Windows, starts the MySQL service, creates the
# 'bengaluru_transit' database + 'btc_app' user, and writes local .env secrets.

$ErrorActionPreference = "Continue"

$ProjectRoot = if ($PSScriptRoot -and (Split-Path -Leaf $PSScriptRoot) -eq "scripts") {
    Split-Path -Parent $PSScriptRoot
} else {
    Join-Path $HOME "BengaluruTransitConnect"
}

New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null
Set-Location -LiteralPath $ProjectRoot

function Find-MySqlBinDir {
    $cmd = Get-Command mysql -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) {
        return (Split-Path -Parent $cmd.Source)
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
                    return (Join-Path $d.FullName "bin")
                }
            }
        }
    }
    return $null
}

Write-Host "=== [1/4] Locating or Installing MySQL 8 Server ===" -ForegroundColor Cyan
$MySqlBin = Find-MySqlBinDir

if (-not $MySqlBin) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] MySQL 8 was not found and winget is unavailable. Install MySQL 8 Community Server from https://dev.mysql.com/downloads/mysql/" -ForegroundColor Red
        return
    }
    Write-Host "  MySQL not found yet. Installing Oracle.MySQL via winget..." -ForegroundColor Yellow
    & winget install -e --id Oracle.MySQL --accept-package-agreements --accept-source-agreements
    $MySqlBin = Find-MySqlBinDir
    if (-not $MySqlBin) {
        Write-Host "[ERROR] Could not locate mysql.exe after winget install. Reopen PowerShell as Administrator and re-run." -ForegroundColor Red
        return
    }
}

Write-Host "  [OK] Found MySQL binaries at: $MySqlBin" -ForegroundColor Green
if ($env:Path -notlike "*$MySqlBin*") {
    $env:Path = "$MySqlBin;$env:Path"
}
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $UserPath) { $UserPath = "" }
if ($UserPath -notlike "*$MySqlBin*") {
    $NewUserPath = if ($UserPath) { "$UserPath;$MySqlBin" } else { "$MySqlBin" }
    [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
    Write-Host "  [OK] Added MySQL bin directory to your User PATH." -ForegroundColor Green
}

$MySqlExe = Join-Path $MySqlBin "mysql.exe"
$MySqldExe = Join-Path $MySqlBin "mysqld.exe"
$MySqlBase = Split-Path -Parent $MySqlBin
$DataDir = Join-Path $MySqlBase "data"

$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

Write-Host "`n=== [2/4] Verifying MySQL Windows Service ===" -ForegroundColor Cyan
$Svc = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1

if (-not $Svc) {
    if (-not $IsAdmin) {
        Write-Host "[ACTION NEEDED] Please run PowerShell as Administrator once to initialize and register the MySQL service." -ForegroundColor Yellow
        return
    }
    if (-not (Test-Path -LiteralPath $DataDir) -or -not (Get-ChildItem -LiteralPath $DataDir -ErrorAction SilentlyContinue)) {
        Write-Host "  Initializing local MySQL data directory at $DataDir ..." -ForegroundColor Yellow
        & "$MySqldExe" --initialize-insecure --basedir="$MySqlBase" --datadir="$DataDir" --console
    }
    Write-Host "  Registering MySQL84 Windows Service..." -ForegroundColor Yellow
    & "$MySqldExe" --install MySQL84
    $Svc = Get-Service -Name "MySQL84" -ErrorAction SilentlyContinue
}

if ($Svc -and $Svc.Status -ne "Running") {
    if ($IsAdmin) {
        Write-Host "  Starting service $($Svc.Name)..." -ForegroundColor Yellow
        Start-Service -Name $Svc.Name
        Start-Sleep -Seconds 3
    } else {
        Write-Host "[ACTION NEEDED] Service $($Svc.Name) is stopped. Start it in an Admin PowerShell with: Start-Service $($Svc.Name)" -ForegroundColor Yellow
        return
    }
}
$Svc = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($Svc) {
    Write-Host "  [OK] Service $($Svc.Name) is $($Svc.Status)." -ForegroundColor Green
}

Write-Host "`n=== [3/4] Creating 'bengaluru_transit' Database & Local .env Credentials ===" -ForegroundColor Cyan
$EnvFile = Join-Path $ProjectRoot ".env"
$AppPass = $null
$JwtSecret = $null

if (Test-Path -LiteralPath $EnvFile) {
    foreach ($line in (Get-Content -LiteralPath $EnvFile)) {
        if ($line -match "^DB_PASS=(.+)$") { $AppPass = $Matches[1].Trim() }
        if ($line -match "^JWT_SECRET=(.+)$") { $JwtSecret = $Matches[1].Trim() }
    }
}
if (-not $AppPass) {
    $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $rng = New-Object System.Random
    $AppPass = "Btc" + -join (1..16 | ForEach-Object { $chars[$rng.Next(0, $chars.Length)] })
}
if (-not $JwtSecret) {
    $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789"
    $rng = New-Object System.Random
    $JwtSecret = -join (1..48 | ForEach-Object { $chars[$rng.Next(0, $chars.Length)] })
}

$BootstrapSql = @(
    "SET PERSIST log_bin_trust_function_creators = 1;",
    "CREATE DATABASE IF NOT EXISTS bengaluru_transit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE USER IF NOT EXISTS 'btc_app'@'localhost' IDENTIFIED BY '$AppPass';",
    "ALTER USER 'btc_app'@'localhost' IDENTIFIED BY '$AppPass';",
    "GRANT ALL PRIVILEGES ON bengaluru_transit.* TO 'btc_app'@'localhost';",
    "FLUSH PRIVILEGES;"
) -join " "

# Try passwordless root first (fresh --initialize-insecure install), otherwise prompt once
& "$MySqlExe" -u root --connect-timeout=5 -e "$BootstrapSql" 2>$null
if ($LASTEXITCODE -ne 0) {
    $SecRoot = Read-Host "Enter your existing MySQL 'root' password" -AsSecureString
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecRoot)
    $PlainRoot = [Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    $env:MYSQL_PWD = $PlainRoot
    & "$MySqlExe" -u root --connect-timeout=5 -e "$BootstrapSql"
    $rootExit = $LASTEXITCODE
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    if ($rootExit -ne 0) {
        Write-Host "[ERROR] Could not authenticate as MySQL root. Check your root password and re-run .\\scripts\\setup_mysql.ps1" -ForegroundColor Red
        return
    }
}

$EnvContent = @(
    "DB_HOST=localhost",
    "DB_PORT=3306",
    "DB_NAME=bengaluru_transit",
    "DB_URL=jdbc:mysql://localhost:3306/bengaluru_transit?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata",
    "DB_USER=btc_app",
    "DB_PASS=$AppPass",
    "JWT_SECRET=$JwtSecret",
    "SERVER_PORT=8080",
    "VITE_API_BASE_URL=http://localhost:8080/api"
) -join "`n"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($EnvFile, $EnvContent + "`n", $Utf8NoBom)
Write-Host "  [OK] Database 'bengaluru_transit' ready and credentials saved to .env (excluded from Git)." -ForegroundColor Green

Write-Host "`n=== [4/4] Smoke-Testing MySQL Connection as 'btc_app' ===" -ForegroundColor Cyan
$env:MYSQL_PWD = $AppPass
& "$MySqlExe" -u btc_app -D bengaluru_transit -e "SELECT VERSION() AS mysql_version, DATABASE() AS active_database, NOW() AS server_time;"
$testExit = $LASTEXITCODE
Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue

if ($testExit -eq 0) {
    Write-Host "`n[SUCCESS] Phase 1 & Phase 2 workspace + MySQL 8 database server are READY at: $ProjectRoot" -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] Verification query failed with exit code $testExit." -ForegroundColor Red
}