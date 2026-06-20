#!/usr/bin/env bash
set -euo pipefail

PROFILE=/home/lingke01/snap/chromium/common/leadtek-doc-chrome
DOC_URL='https://doc.weixin.qq.com/sheet/e2_AOYAcQY0AOkHeTbrsb1S1yjV7o0No?scode=AH4A8gcSAA4jUF2v5V&tab=6gp6rt'

mkdir -p "$PROFILE"
pkill -u lingke01 -f 'remote-debugging-port=9222' 2>/dev/null || true

DISPLAY=:0 XAUTHORITY=/run/user/1000/gdm/Xauthority nohup /snap/bin/chromium \
  --user-data-dir="$PROFILE" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --no-first-run \
  --disable-default-apps \
  --password-store=basic \
  "$DOC_URL" \
  > /home/lingke01/leadtek-doc-chrome.log 2>&1 &

echo $! > /home/lingke01/leadtek-doc-chrome.pid
sleep 6

echo '--- processes'
ps -ef | grep -iE 'chromium|chrome|remote-debugging-port=9222' | grep -v grep || true
echo '--- port'
ss -ltnp | grep 9222 || true
echo '--- targets'
curl -sS --max-time 5 http://127.0.0.1:9222/json/list | head -c 2000 || true
echo
echo '--- log'
tail -n 80 /home/lingke01/leadtek-doc-chrome.log || true
