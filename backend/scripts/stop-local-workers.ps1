param(
  [int]$Port = 8787
)

$ErrorActionPreference = "SilentlyContinue"

# 1) Kill anything listening on the target port (usually wrangler/workerd)
$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen
foreach ($l in $listeners) {
  if ($l.OwningProcess -and $l.OwningProcess -ne 0) {
    Stop-Process -Id $l.OwningProcess -Force
  }
}

# 2) Also kill orphaned workerd instances spawned from this repo's node_modules (common on Windows)
$repoWorkerd = Get-Process workerd | Where-Object {
  $_.Path -and ($_.Path -like "*\\logistics-system\\backend\\node_modules\\@cloudflare\\workerd-windows-64\\bin\\workerd.exe")
}
if ($repoWorkerd) {
  $repoWorkerd | Stop-Process -Force
}

Write-Output "Stopped local worker processes (port=$Port)."

