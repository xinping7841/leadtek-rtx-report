#!/usr/bin/env bash
# edit-lock.sh — Git 文件编辑锁，防止多终端同时修改代码
# 用法:
#   bash scripts/edit-lock.sh status         查看锁状态
#   bash scripts/edit-lock.sh acquire <原因>   获取编辑锁
#   bash scripts/edit-lock.sh release         释放编辑锁
#   bash scripts/edit-lock.sh force-release   强制释放（跳过用户校验）
set -euo pipefail

LOCK_FILE="$(dirname "$0")/../.edit-lock.json"
GIT_DIR="$(dirname "$0")/.."

die() { echo "[LOCK] ❌ $1" >&2; exit 1; }
info() { echo "[LOCK] $1"; }

# ── 读取当前锁状态 ──
read_lock() {
  if [[ ! -f "$LOCK_FILE" ]]; then
    echo '{"locked":false}'
  else
    cat "$LOCK_FILE"
  fi
}

# ── 检查是否过期 ──
is_expired() {
  local expires_at
  expires_at=$(echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('expiresAt',''))" 2>/dev/null || echo "")
  if [[ -z "$expires_at" || "$expires_at" == "null" ]]; then
    return 1
  fi
  local now_epoch expiry_epoch
  now_epoch=$(date +%s)
  expiry_epoch=$(date -d "$expires_at" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${expires_at%+*}" +%s 2>/dev/null || echo 0)
  [[ "$now_epoch" -ge "$expiry_epoch" ]]
}

# ── 获取当前用户/机器 ──
whoami_str() {
  echo "${USER:-$(whoami)}@${HOSTNAME:-$(hostname)}"
}

# ── status ──
cmd_status() {
  local lock locked user machine timestamp message expires
  lock=$(read_lock)
  locked=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('locked',False))")
  
  if [[ "$locked" != "True" ]]; then
    info "🔓 编辑锁：空闲，可以开始修改代码。"
    return 0
  fi

  if is_expired "$lock"; then
    info "⏰ 编辑锁已过期（$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user','?'))") 在 $(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('timestamp','?'))") 获取），视为空闲。请用 force-release 清除。"
    return 0
  fi

  user=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user','?'))")
  machine=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('machine','?'))")
  timestamp=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('timestamp','?'))")
  message=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))")
  expires=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expiresAt',''))")

  echo ""
  echo "🔒 编辑锁已被占用 — 请勿修改代码！"
  echo "  持有者   : $user"
  echo "  机器     : $machine"
  echo "  锁定时间 : $timestamp"
  echo "  过期时间 : $expires"
  echo "  原因     : $message"
  echo ""
  return 1
}

# ── acquire ──
cmd_acquire() {
  local message="${1:-}"
  local lock locked who
  
  lock=$(read_lock)
  locked=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('locked',False))")

  if [[ "$locked" == "True" ]] && ! is_expired "$lock"; then
    cmd_status
    die "锁被占用，无法获取。等待对方 release 或锁过期后重试。"
  fi

  who=$(whoami_str)
  local now expires expiry_hours
  now=$(date -Iseconds 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%:z")
  expiry_hours=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expiryHours',4))")
  
  # 计算过期时间
  if date -d "+${expiry_hours} hours" +"%Y-%m-%dT%H:%M:%S%:z" &>/dev/null; then
    expires=$(date -d "+${expiry_hours} hours" +"%Y-%m-%dT%H:%M:%S%:z")
  else
    expires=$(date -v +${expiry_hours}H +"%Y-%m-%dT%H:%M:%S%:z" 2>/dev/null || echo "")
  fi

  python3 -c "
import json, sys
data = json.load(open('$LOCK_FILE'))
data['locked'] = True
data['user'] = '${who}'
data['machine'] = '${HOSTNAME:-unknown}'
data['timestamp'] = '${now}'
data['message'] = '${message}'
data['expiresAt'] = '${expires}'
json.dump(data, open('$LOCK_FILE','w'), indent=2, ensure_ascii=False)
print('ok')
"

  info "🔒 编辑锁已获取 — 现在可以安全修改代码。"
  info "   持有者: $who"
  info "   过期时间: $expires"
  info ""
  info "   完成修改后请执行: bash scripts/edit-lock.sh release"
  info "   (过期后自动失效，无需手动释放)"
}

# ── release ──
cmd_release() {
  local lock locked who current
  lock=$(read_lock)
  locked=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('locked',False))")

  if [[ "$locked" != "True" ]]; then
    info "🔓 编辑锁已经是空闲状态，无需释放。"
    return 0
  fi

  if is_expired "$lock"; then
    info "⏰ 锁已过期，自动清除。"
    python3 -c "
import json
data = json.load(open('$LOCK_FILE'))
data['locked'] = False
data['user'] = None
data['machine'] = None
data['timestamp'] = None
data['message'] = None
data['expiresAt'] = None
json.dump(data, open('$LOCK_FILE','w'), indent=2, ensure_ascii=False)
"
    return 0
  fi

  who=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',''))")
  current=$(whoami_str)
  if [[ "$who" != "$current" ]]; then
    die "锁由 $who 持有，$current 不能释放。如确需强制释放请用: bash scripts/edit-lock.sh force-release"
  fi

  python3 -c "
import json
data = json.load(open('$LOCK_FILE'))
data['locked'] = False
data['user'] = None
data['machine'] = None
data['timestamp'] = None
data['message'] = None
data['expiresAt'] = None
json.dump(data, open('$LOCK_FILE','w'), indent=2, ensure_ascii=False)
"
  info "🔓 编辑锁已释放。"
}

# ── force-release ──
cmd_force_release() {
  local lock locked who
  lock=$(read_lock)
  locked=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('locked',False))")
  
  if [[ "$locked" != "True" ]]; then
    info "🔓 编辑锁已经是空闲状态。"
    return 0
  fi

  who=$(echo "$lock" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user','?'))")
  python3 -c "
import json
data = json.load(open('$LOCK_FILE'))
data['locked'] = False
data['user'] = None
data['machine'] = None
data['timestamp'] = None
data['message'] = None
data['expiresAt'] = None
json.dump(data, open('$LOCK_FILE','w'), indent=2, ensure_ascii=False)
"
  info "🔓 已强制释放 $who 的编辑锁。请通知对方！"
}

# ── 路由 ──
case "${1:-}" in
  status)   cmd_status ;;
  acquire)  cmd_acquire "${2:-}" ;;
  release)  cmd_release ;;
  force-release) cmd_force_release ;;
  *)
    echo "用法: bash scripts/edit-lock.sh {status|acquire <原因>|release|force-release}"
    echo ""
    echo "  status          查看当前锁状态"
    echo "  acquire <原因>   获取编辑锁（默认4小时过期）"
    echo "  release          释放编辑锁"
    echo "  force-release    强制释放（跳过用户校验）"
    exit 1
    ;;
esac
