param(
  [int]$IntervalSeconds = 60,
  [string]$NodeScript = ".\scripts\sync-tencent-docs-via-chrome.mjs"
)

$ErrorActionPreference = "Continue"

while ($true) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    Write-Host "[$timestamp] syncing Tencent Docs..."
    node $NodeScript
  } catch {
    Write-Warning "[$timestamp] sync failed: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $IntervalSeconds
}
