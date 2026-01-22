#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Resets the postgres-mcp test database by cleaning up all accumulated test artifacts and re-seeding.

.DESCRIPTION
    This script performs a full cleanup of the postgres-mcp test database:
    1. Drops test schemas (test_schema, test_vector_schema)
    2. Drops temp_* tables
    3. Drops test_* tables  
    4. Drops ai_test_* tables
    5. Drops other accumulated artifacts (partman_*, prompt_*, mcp_*, etc.)
    6. Re-seeds the database from test-database.sql

.PARAMETER SkipVerify
    Skip the verification step after reset.

.PARAMETER Verbose
    Show detailed output for each step.

.EXAMPLE
    .\reset-database.ps1
    
.EXAMPLE
    .\reset-database.ps1 -SkipVerify
#>

param(
    [switch]$SkipVerify,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlFile = Join-Path $ScriptDir "test-database.sql"

# Colors for output
function Write-Step { param($Step, $Message) Write-Host "`n[$Step/7] " -ForegroundColor Cyan -NoNewline; Write-Host $Message -ForegroundColor White }
function Write-Success { param($Message) Write-Host "  ✓ " -ForegroundColor Green -NoNewline; Write-Host $Message }
function Write-Info { param($Message) Write-Host "  → " -ForegroundColor DarkGray -NoNewline; Write-Host $Message -ForegroundColor DarkGray }
function Write-Error { param($Message) Write-Host "  ✗ " -ForegroundColor Red -NoNewline; Write-Host $Message -ForegroundColor Red }

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║           PostgreSQL MCP Test Database Reset               ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Verify prerequisites
if (-not (Test-Path $SqlFile)) {
    Write-Error "test-database.sql not found at: $SqlFile"
    exit 1
}

# Check Docker is running and container exists
$containerCheck = docker ps --filter "name=postgres-server" --format "{{.Names}}" 2>&1
if ($containerCheck -ne "postgres-server") {
    Write-Error "postgres-server container is not running. Start it first."
    exit 1
}
Write-Host "`nContainer: " -NoNewline; Write-Host "postgres-server" -ForegroundColor Green -NoNewline; Write-Host " is running"

# ============================================================================
# Step 1: Drop test schemas
# ============================================================================
Write-Step "1" "Dropping test schemas..."

$sql1 = "DROP SCHEMA IF EXISTS test_schema CASCADE; DROP SCHEMA IF EXISTS test_vector_schema CASCADE;"
$result = docker exec postgres-server psql -U postgres -d postgres -c $sql1 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Dropped test_schema and test_vector_schema"
} else {
    Write-Error "Failed to drop schemas: $result"
}

# ============================================================================
# Step 2: Drop temp_* tables
# ============================================================================
Write-Step "2" "Dropping temp_* tables..."

$sql2 = @"
DO `$`$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename FROM pg_tables 
             WHERE tablename LIKE 'temp_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END`$`$;
"@
$result = docker exec postgres-server psql -U postgres -d postgres -c $sql2 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Dropped all temp_* tables"
} else {
    Write-Error "Failed to drop temp_* tables: $result"
}

# ============================================================================
# Step 3: Clean up pg_partman configurations
# ============================================================================
Write-Step "3" "Cleaning up pg_partman configurations..."

$sql3 = @"
DO `$`$
BEGIN
    -- Delete partman configs for test_* tables (prevents orphaned configs)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'part_config' AND schemaname IN ('public', 'partman')) THEN
        DELETE FROM public.part_config WHERE parent_table LIKE 'public.test_%';
        DELETE FROM public.part_config WHERE parent_table LIKE 'public.temp_%';
    END IF;
    
    -- Drop template tables created by partman for test tables
    FOR r IN SELECT schemaname, tablename FROM pg_tables 
             WHERE tablename LIKE 'template_public_test_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END`$`$;
"@
$result = docker exec postgres-server psql -U postgres -d postgres -c $sql3 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Cleaned up pg_partman configurations and template tables"
} else {
    Write-Info "pg_partman cleanup skipped (extension may not be installed)"
}

# ============================================================================
# Step 4: Drop test_* tables
# ============================================================================
Write-Step "4" "Dropping test_* tables..."

$sql4 = @"
DO `$`$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename FROM pg_tables 
             WHERE tablename LIKE 'test_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END`$`$;
"@
$result = docker exec postgres-server psql -U postgres -d postgres -c $sql4 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Dropped all test_* tables"
} else {
    Write-Error "Failed to drop test_* tables: $result"
}

# ============================================================================
# Step 5: Drop ai_test_* tables
# ============================================================================
Write-Step "5" "Dropping ai_test_* tables..."

$sql5 = @"
DO `$`$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename FROM pg_tables 
             WHERE tablename LIKE 'ai_test_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END`$`$;
"@
$result = docker exec postgres-server psql -U postgres -d postgres -c $sql5 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Dropped all ai_test_* tables"
} else {
    Write-Error "Failed to drop ai_test_* tables: $result"
}

# ============================================================================
# Step 6: Drop other accumulated artifacts
# ============================================================================
Write-Step "6" "Dropping other accumulated artifacts..."
Write-Info "partman_*, prompt_*, mcp_*, orders_*, ltree_*, fts_*, spatial_places*, jsonb_*, notebook_*, empty_*, batch_*, etc."

$sql6 = @"
DO `$`$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename FROM pg_tables 
             WHERE (
                 tablename LIKE 'partman_%' 
                 OR tablename LIKE 'prompt_%' 
                 OR tablename LIKE 'mcp_%' 
                 OR tablename LIKE 'orders_%' 
                 OR tablename LIKE 'ltree_%' 
                 OR tablename LIKE 'fts_%' 
                 OR tablename LIKE 'spatial_places%' 
                 OR tablename LIKE 'jsonb_%' 
                 OR tablename LIKE 'notebook_%' 
                 OR tablename IN ('categories','documents','locations','vector_docs','txn_demo') 
                 OR tablename LIKE 'empty_%' 
                 OR tablename LIKE 'batch_%'
             ) 
             AND schemaname = 'public' 
             AND tablename != 'spatial_ref_sys'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END`$`$;
"@
$result = docker exec postgres-server psql -U postgres -d postgres -c $sql6 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Dropped all accumulated artifact tables"
} else {
    Write-Error "Failed to drop artifact tables: $result"
}

# ============================================================================
# Step 7: Re-seed the database
# ============================================================================
Write-Step "7" "Re-seeding the database..."

# Copy SQL file to container
$copyResult = docker cp $SqlFile postgres-server:/tmp/test-database.sql 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to copy SQL file to container: $copyResult"
    exit 1
}

# Execute the SQL file
$seedResult = docker exec postgres-server psql -U postgres -d postgres -f /tmp/test-database.sql 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Database re-seeded from test-database.sql"
    if ($Verbose) {
        Write-Info "Last 5 lines of output:"
        $seedResult | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
} else {
    Write-Error "Failed to seed database: $seedResult"
    exit 1
}

# ============================================================================
# Verification
# ============================================================================
if (-not $SkipVerify) {
    Write-Host "`n────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "Verification" -ForegroundColor Yellow
    
    $countResult = docker exec postgres-server psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>&1
    # Handle array results and extract the numeric value
    $countStr = if ($countResult -is [array]) { $countResult -join "" } else { $countResult }
    $tableCount = [int]($countStr -replace '\s','')
    
    Write-Host "  Table count in public schema: " -NoNewline
    if ($tableCount -ge 15 -and $tableCount -le 30) {
        Write-Host $tableCount -ForegroundColor Green -NoNewline
        Write-Host " (expected: 15-25)"
    } else {
        Write-Host $tableCount -ForegroundColor Yellow -NoNewline
        Write-Host " (expected: 15-25, may need investigation)"
    }
    
    # List test tables
    if ($Verbose) {
        Write-Host "`n  Test tables:" -ForegroundColor DarkGray
        $tables = docker exec postgres-server psql -U postgres -d postgres -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'test_%' ORDER BY tablename;" 2>&1
        $tableLines = if ($tables -is [array]) { $tables } else { $tables -split "`n" }
        $tableLines | Where-Object { $_ -and $_.Trim() } | ForEach-Object { Write-Host "    • $($_.Trim())" -ForegroundColor DarkGray }
    }
}

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    Reset Complete! ✓                       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
