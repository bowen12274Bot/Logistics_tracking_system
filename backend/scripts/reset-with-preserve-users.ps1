Param(
  [string]$DatabaseBinding = "DB",
  [switch]$Yes,
  [string]$ConfigPath = ""
)

# Reset database but preserve and restore default user accounts
$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $backendDir

# List of default user IDs that should be preserved and reset
$defaultUserIds = @(
  'user-cust-1',
  'user-cust-2',
  'user-driver-0',
  'user-warehouse-0',
  'user-cs-0',
  'user-admin-0'
)

if (-not $Yes) {
  $confirm = Read-Host "This will RESET the remote D1 database '$DatabaseBinding', preserving default user accounts. Type RESET to continue"
  if ($confirm -ne "RESET") {
    Write-Host "Aborted."
    exit 1
  }
}

Write-Host "Resetting remote database (preserving default users)..."

# Step 1: Delete all delivery-related data
Write-Host "Step 1: Clearing delivery data..."
$wranglerArgs = @()
if ($ConfigPath) { $wranglerArgs += @("--config", $ConfigPath) }

$clearCmd = "DELETE FROM package_events; DELETE FROM package_exceptions; DELETE FROM packages; DELETE FROM delivery_tasks; DELETE FROM vehicle_cargo; DELETE FROM vehicles; DELETE FROM payments; DELETE FROM monthly_billing_items; DELETE FROM monthly_billing; DELETE FROM contract_applications; DELETE FROM tokens; DELETE FROM system_errors; DELETE FROM access_logs; DELETE FROM rate_limits;"

& npx wrangler @wranglerArgs d1 execute $DatabaseBinding --remote --command $clearCmd --yes
if ($LASTEXITCODE -ne 0) { throw "Failed to clear delivery data." }

# Step 2: Reset default users and delete non-default users
Write-Host "Step 2: Resetting user accounts..."
$userIdList = ($defaultUserIds | ForEach-Object { "'$_'" }) -join ','

$resetUsersCmd = "UPDATE users SET status = 'active', deleted_at = NULL, suspended_at = NULL, suspended_reason = NULL WHERE id IN ($userIdList) OR id LIKE 'user-driver-hub_%' OR id LIKE 'user-warehouse-hub_%' OR id LIKE 'user-warehouse-reg_%';"

& npx wrangler @wranglerArgs d1 execute $DatabaseBinding --remote --command $resetUsersCmd --yes
if ($LASTEXITCODE -ne 0) { throw "Failed to reset user accounts." }

$deleteUsersCmd = "DELETE FROM users WHERE id NOT IN ($userIdList) AND id NOT LIKE 'user-driver-hub_%' AND id NOT LIKE 'user-warehouse-hub_%' AND id NOT LIKE 'user-warehouse-reg_%';"

& npx wrangler @wranglerArgs d1 execute $DatabaseBinding --remote --command $deleteUsersCmd --yes
if ($LASTEXITCODE -ne 0) { throw "Failed to delete non-default users." }

# Step 3: Re-apply demo data
Write-Host "Step 3: Re-applying demo data..."
$seedDataPath = Join-Path $backendDir "migrations\0017_seed_demo_data.sql"
if (Test-Path $seedDataPath) {
  & npx wrangler @wranglerArgs d1 execute $DatabaseBinding --remote --file $seedDataPath --yes
  if ($LASTEXITCODE -ne 0) { 
    Write-Warning "Failed to apply demo data. Core reset completed successfully."
  }
} else {
  Write-Warning "Seed data file not found at $seedDataPath. Skipping demo data insertion."
}

Write-Host "Remote database reset complete (default users preserved and restored)." -ForegroundColor Green
