# edit-lock.ps1 — Git 文件编辑锁
# 用法:
#   powershell -File scripts/edit-lock.ps1 status
#   powershell -File scripts/edit-lock.ps1 acquire "原因"
#   powershell -File scripts/edit-lock.ps1 release
#   powershell -File scripts/edit-lock.ps1 force-release
param(
  [Parameter(Position=0)]
  [ValidateSet("status","acquire","release","force-release")]
  [string]$Command,

  [Parameter(Position=1)]
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LockFile = Join-Path $ScriptDir "..\.edit-lock.json" | Resolve-Path

function Read-Lock {
  if (Test-Path $LockFile) {
    Get-Content $LockFile -Raw | ConvertFrom-Json
  } else {
    [pscustomobject]@{locked = $false}
  }
}

function Is-Expired($lock) {
  if (-not $lock.expiresAt -or $lock.expiresAt -eq $null) { return $false }
  try {
    $expiry = [DateTime]::Parse($lock.expiresAt)
    return (Get-Date) -ge $expiry
  } catch {
    return $false
  }
}

function WhoAmI {
  "$env:USERNAME@$env:COMPUTERNAME"
}

function Write-Lock($data) {
  # 使用 UTF8NoBOM 避免 Linux 上 Python json 解析报错
  $json = $data | ConvertTo-Json -Depth 4
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($LockFile, $json, $utf8NoBom)
}

# -- status --
function Status {
  $lock = Read-Lock
  if (-not $lock.locked) {
    Write-Host "[LOCK] UNLOCKED - safe to edit." -ForegroundColor Green
    return
  }
  if (Is-Expired $lock) {
    Write-Host "[LOCK] EXPIRED ($($lock.user) at $($lock.timestamp)) - treated as free. Use force-release to clear." -ForegroundColor Yellow
    return
  }
  Write-Host ""
  Write-Host "=== EDIT LOCK ACTIVE - DO NOT EDIT ===" -ForegroundColor Red
  Write-Host "  Holder    : $($lock.user)"
  Write-Host "  Machine   : $($lock.machine)"
  Write-Host "  Locked at : $($lock.timestamp)"
  Write-Host "  Expires at: $($lock.expiresAt)"
  Write-Host "  Reason    : $($lock.message)"
  Write-Host ""
  exit 1
}

# -- acquire --
function Acquire {
  $lock = Read-Lock
  if ($lock.locked -and -not (Is-Expired $lock)) {
    Status
    throw "Lock is held by $($lock.user). Wait for release or expiry."
  }

  $who = WhoAmI
  $now = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
  $expiryHours = if ($lock.expiryHours) { $lock.expiryHours } else { 4 }
  $expires = (Get-Date).AddHours($expiryHours).ToString("yyyy-MM-ddTHH:mm:sszzz")

  $lock.locked = $true
  $lock.user = $who
  $lock.machine = $env:COMPUTERNAME
  $lock.timestamp = $now
  $lock.message = $Message
  $lock.expiresAt = $expires
  if (-not (Get-Member -InputObject $lock -Name "expiryHours" -MemberType Properties)) {
    $lock | Add-Member -NotePropertyName "expiryHours" -NotePropertyValue 4 -Force
  }

  Write-Lock $lock

  Write-Host "[LOCK] LOCK ACQUIRED - safe to edit now." -ForegroundColor Green
  Write-Host "  Holder    : $who"
  Write-Host "  Expires at: $expires"
  Write-Host ""
  Write-Host "  Run 'powershell -File scripts/edit-lock.ps1 release' when done."
  Write-Host "  (Lock auto-expires after $expiryHours hours.)"
}

# -- release --
function Release {
  $lock = Read-Lock
  if (-not $lock.locked) {
    Write-Host "[LOCK] Already unlocked." -ForegroundColor Green
    return
  }
  if (Is-Expired $lock) {
    Write-Host "[LOCK] Lock expired, auto-clearing."
    Reset-Lock
    return
  }

  $current = WhoAmI
  if ($lock.user -ne $current) {
    throw "Lock held by $($lock.user), not by $current. Use force-release if needed."
  }

  Reset-Lock
  Write-Host "[LOCK] RELEASED." -ForegroundColor Green
}

# -- force-release --
function ForceRelease {
  $lock = Read-Lock
  if (-not $lock.locked) {
    Write-Host "[LOCK] Already unlocked."
    return
  }
  $who = $lock.user
  Reset-Lock
  Write-Host "[LOCK] FORCE-RELEASED (was held by $who). Please notify them!" -ForegroundColor Yellow
}

function Reset-Lock {
  $data = [pscustomobject]@{
    locked       = $false
    user         = $null
    machine      = $null
    timestamp    = $null
    message      = $null
    expiresAt    = $null
    expiryHours  = 4
  }
  Write-Lock $data
}

# -- route --
switch ($Command) {
  "status"         { Status }
  "acquire"        { Acquire }
  "release"        { Release }
  "force-release"  { ForceRelease }
  default {
    Write-Host "Usage: powershell -File scripts/edit-lock.ps1 {status|acquire <reason>|release|force-release}"
    Write-Host ""
    Write-Host "  status           Show lock status"
    Write-Host "  acquire <reason> Acquire edit lock (4h expiry)"
    Write-Host "  release          Release edit lock"
    Write-Host "  force-release    Force release (skip user check)"
    exit 1
  }
}
