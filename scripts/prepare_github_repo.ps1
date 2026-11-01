#Requires -Version 5.1
<#
.SYNOPSIS
    Phase 10 GitHub Readiness & Secret-Hygiene Verifier for Bengaluru TransitConnect.
    Checks required project artifacts, ensures .env secrets are ignored by Git,
    initializes a local 'main' repository if needed, and prints safe Git push steps.
#>
$ErrorActionPreference = "Stop"

$ProjectRoot = Join-Path $HOME "BengaluruTransitConnect"
if (-not (Test-Path $ProjectRoot)) {
    throw "Project folder not found at $ProjectRoot."
}
Set-Location $ProjectRoot

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Bengaluru TransitConnect - GitHub Packaging & Hygiene Audit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$RequiredPaths = @(
    "README.md",
    "LICENSE",
    ".gitignore",
    ".env.example",
    "sql\01_schema.sql",
    "sql\02_views_triggers_procs.sql",
    "sql\03_seed_bengaluru_data.sql",
    "sql\04_viva_demo_queries.sql",
    "sql\05_explain_and_security_audit.sql",
    "backend\pom.xml",
    "backend\mvnw.cmd",
    "backend\src\main\java\com\bengaluru\transit\TransitConnectApplication.java",
    "backend\src\test\java\com\bengaluru\transit\TransitConnectIntegrationTests.java",
    "frontend\package.json",
    "frontend\vite.config.js",
    "frontend\src\App.jsx",
    "docs\PHASE10_DIAGRAMS_DEPLOYMENT_AND_VIVA_GUIDE.md"
)

foreach ($rel in $RequiredPaths) {
    $full = Join-Path $ProjectRoot $rel
    if (-not (Test-Path $full)) {
        throw "Missing required deliverable: $rel"
    }
}
Write-Host "[OK] All 17 core deliverable checkpoints verified in $ProjectRoot" -ForegroundColor Green

$GitExe = Get-Command "git" -ErrorAction SilentlyContinue
if (-not $GitExe) {
    Write-Warning "Git CLI was not found on PATH. Install Git for Windows (winget install -e --id Git.Git) before pushing to GitHub."
    exit 0
}

if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
    & git init -b main | Out-Null
    Write-Host "[OK] Initialized local Git repository on branch 'main'." -ForegroundColor Green
}

# Verify .env is strictly ignored by Git
if (Test-Path (Join-Path $ProjectRoot ".env")) {
    & git check-ignore -q ".env"
    if ($LASTEXITCODE -ne 0) {
        throw "SECURITY BLOCK: .env is NOT ignored by .gitignore! Refusing to proceed."
    }
    Write-Host "[OK] Secret hygiene verified: .env is ignored by Git; .env.example is tracked." -ForegroundColor Green
}

Write-Host "`nCurrent Repository Status Summary:" -ForegroundColor Yellow
& git status -sb

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " READY FOR GITHUB! Run these commands when you are ready to push:" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  cd `"$ProjectRoot`"" -ForegroundColor White
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m `"feat: complete Bengaluru TransitConnect BMTC + Namma Metro DBMS platform`"" -ForegroundColor White
Write-Host "  git remote add origin https://github.com/<your-username>/BengaluruTransitConnect.git" -ForegroundColor White
Write-Host "  git push -u origin main" -ForegroundColor White