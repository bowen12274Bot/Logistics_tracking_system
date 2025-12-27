param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommandArgs
)

try {
  chcp 65001 > $null
} catch {
  # ignore
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

if (-not $CommandArgs -or $CommandArgs.Count -eq 0) {
  Write-Host "Usage: .\\scripts\\utf8.ps1 <command> [args...]" -ForegroundColor Yellow
  exit 1
}

$exe = $CommandArgs[0]
$args = @()
if ($CommandArgs.Count -gt 1) { $args = $CommandArgs[1..($CommandArgs.Count - 1)] }

& $exe @args
exit $LASTEXITCODE

