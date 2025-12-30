Param(
  [string]$DatabaseBinding = "DB",
  [switch]$Yes,
  [switch]$DropOnly,
  [switch]$KeepMigrationHistory,
  [string[]]$ExtraDropTables = @(),
  [string]$ConfigPath = ""
)

# Drops application tables on the remote D1 database and (optionally) reapplies every SQL migration.
$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $backendDir

# Discover tables/indexes from migrations to avoid drift.
$migrationsDir = Join-Path $backendDir "migrations"
$migrationTables = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$migrationIndexes = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)

if (Test-Path $migrationsDir) {
  $migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name
  foreach ($file in $migrationFiles) {
    $sql = Get-Content -LiteralPath $file.FullName -Raw

    foreach ($match in [regex]::Matches($sql, '(?im)^[\\s]*CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:\\[\\s*)?([A-Za-z0-9_]+)(?:\\s*\\])?[\\s]*\\(')) {
      [void]$migrationTables.Add($match.Groups[1].Value)
    }

    foreach ($match in [regex]::Matches($sql, '(?im)^[\\s]*CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:\\[\\s*)?([A-Za-z0-9_]+)(?:\\s*\\])?[\\s]+ON\\b')) {
      [void]$migrationIndexes.Add($match.Groups[1].Value)
    }
  }
}

$indexes = @($migrationIndexes) | Sort-Object
$tables = @($migrationTables) | Sort-Object

if ($tables.Count -eq 0) {
  throw "No migration tables discovered under '$migrationsDir'. Aborting to avoid incomplete drop."
}

if (-not $Yes) {
  $actionText = if ($DropOnly) { "DROP tables only" } else { "DROP tables and REAPPLY migrations" }
  $historyText = if ($KeepMigrationHistory) { " (keeping migration history)" } else { " (dropping migration history)" }
  $confirm = Read-Host "This will $actionText$historyText on the remote D1 database '$DatabaseBinding'. Type DROP to continue"
  if ($confirm -ne "DROP") {
    Write-Host "Aborted."
    exit 1
  }
}

$dropSqlLines = @("PRAGMA foreign_keys=OFF;")
$dropSqlLines += $indexes | ForEach-Object { "DROP INDEX IF EXISTS [$($_)];" }
$dropSqlLines += $tables | ForEach-Object { "DROP TABLE IF EXISTS [$($_)];" }
if (-not $KeepMigrationHistory) {
  $dropSqlLines += "DROP TABLE IF EXISTS [d1_migrations];"
  $dropSqlLines += "DROP TABLE IF EXISTS [d1_migrations_lock];"
}
if ($ExtraDropTables.Count -gt 0) {
  $dropSqlLines += $ExtraDropTables | ForEach-Object { "DROP TABLE IF EXISTS [$($_)];" }
}
$dropSqlLines += @("PRAGMA foreign_keys=ON;")
$dropSql = ($dropSqlLines -join "`n")

Write-Host "Dropping remote tables..."
$tempDropFile = Join-Path ([System.IO.Path]::GetTempPath()) ("d1-drop-" + [Guid]::NewGuid().ToString() + ".sql")
Set-Content -Path $tempDropFile -Value $dropSql -Encoding UTF8
try {
  $wranglerArgs = @()
  if ($ConfigPath) { $wranglerArgs += @("--config", $ConfigPath) }
  & npx wrangler @wranglerArgs d1 execute $DatabaseBinding --remote --file $tempDropFile
  if ($LASTEXITCODE -ne 0) {
    throw "Dropping remote tables failed."
  }
} finally {
  Remove-Item -LiteralPath $tempDropFile -Force -ErrorAction SilentlyContinue
}

if ($DropOnly) {
  Write-Host "Remote tables dropped (no migrations applied)."
  exit 0
}

Write-Host "Applying D1 migrations (remote)..."
$wranglerArgs = @()
if ($ConfigPath) { $wranglerArgs += @("--config", $ConfigPath) }
& npx wrangler @wranglerArgs d1 migrations apply $DatabaseBinding --remote
if ($LASTEXITCODE -ne 0) {
  throw "Remote migration apply failed."
}

Write-Host "Remote database reset complete."
