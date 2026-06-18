#!/usr/bin/env bash
set -u

APP_DIR=${APP_DIR:-/opt/leadtek-rtx-report}
INTERVAL_SECONDS=${INTERVAL_SECONDS:-60}
LOG_FILE=${LOG_FILE:-/var/log/leadtek-doc-sync.log}

cd "$APP_DIR" || exit 1
mkdir -p data

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG_FILE"
}

while true; do
  log "syncing Tencent Docs from 121 Chromium..."

  if /usr/bin/node scripts/sync-tencent-docs-via-chrome.mjs --output=data/gpu-test-results.json >>"$LOG_FILE" 2>&1; then
    chmod 644 data/gpu-test-results.json
    log "sync ok: data/gpu-test-results.json"
  else
    log "sync failed; keeping previous JSON"
  fi

  sleep "$INTERVAL_SECONDS"
done
