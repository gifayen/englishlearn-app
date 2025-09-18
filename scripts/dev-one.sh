#!/usr/bin/env bash
# 一鍵啟動腳本：環境檢查 → 檢測 LanguageTool 端點 → 啟動 Next.js(3000) → 自動開啟 /essay-checker
set -euo pipefail

echo "───────── englishlearn-app :: one-click dev ─────────"
PROJECT_ROOT="$(pwd)"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "✖ 找不到 package.json，請先 cd 到專案根目錄再執行。"
  exit 1
fi

# 1) Node 版本提示（若 .nvmrc 存在就建議使用）
if command -v node >/dev/null 2>&1; then
  NODEV="$(node -v)"
  echo "• Node 版本: $NODEV"
else
  echo "✖ 找不到 Node，請先安裝 Node.js（建議 v18.18+ 或 v20+）"
  exit 1
fi
if [ -f ".nvmrc" ]; then
  echo "• 偵測到 .nvmrc：$(cat .nvmrc)"
  if command -v nvm >/dev/null 2>&1; then
    echo "  小提醒：可執行 'nvm use' 以切到專案預設版本。"
  fi
fi

# 2) 檢查 .env.local 與關鍵環境變數
if [ ! -f ".env.local" ]; then
  echo "✖ 專案缺少 .env.local，請先建立並填入必要變數。"
  exit 1
fi

check_var() {
  local key="$1"
  if ! grep -E "^${key}=" .env.local >/dev/null 2>&1; then
    echo "  - ${key}: 未設定"
    return 1
  else
    local val="$(grep -E "^${key}=" .env.local | sed "s/^${key}=//")"
    if [ -z "$val" ]; then
      echo "  - ${key}: 空值"
      return 1
    else
      echo "  - ${key}: 已設定"
      return 0
    fi
  fi
}

echo "• 檢查 .env.local："
ENV_OK=1
check_var "NEXT_PUBLIC_SUPABASE_URL" || ENV_OK=0
check_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" || ENV_OK=0
# LanguageTool
# 若你有 Premium 金鑰，LT_API_KEY 與 LT_PLUS_ENDPOINT 會被優先使用
if grep -E "^LT_API_KEY=" .env.local >/dev/null 2>&1; then
  echo "  - LT_API_KEY: 已偵測（有值則會優先走 Plus 端點）"
else
  echo "  - LT_API_KEY: 未偵測（將使用免費端點或你設定的 LT_ENDPOINT）"
fi
check_var "LT_TIMEOUT_MS" || true
check_var "LT_MAX_CHARS" || true
check_var "LT_LEVEL" || true
check_var "LT_DEFAULT_LANG" || true

if [ $ENV_OK -eq 0 ]; then
  echo "✖ .env.local 有關鍵變數未設定，請先修正後再執行。"
  exit 1
fi

# 3) 檢測 LanguageTool 端點健康
# 讀取 .env.local 內的設定（只取必要的，不 export）
LT_API_KEY="$(grep -E "^LT_API_KEY=" .env.local | sed 's/^LT_API_KEY=//')"
LT_PLUS_ENDPOINT="$(grep -E "^LT_PLUS_ENDPOINT=" .env.local | sed 's/^LT_PLUS_ENDPOINT=//')"
LT_ENDPOINT="$(grep -E "^LT_ENDPOINT=" .env.local | sed 's/^LT_ENDPOINT=//')"

# 預設端點（若沒設就用官方）
if [ -z "${LT_PLUS_ENDPOINT:-}" ]; then
  LT_PLUS_ENDPOINT="https://api.languagetoolplus.com/v2/check"
fi
if [ -z "${LT_ENDPOINT:-}" ]; then
  LT_ENDPOINT="https://languagetool.org/api/v2/check"
fi

echo "• 檢測 LanguageTool 端點（/languages）："
curl_quiet() {
  # $1 = URL
  local url="$1"
  # 不顯示 body，只顯示 HTTP 狀態碼
  curl -sS -o /dev/null -w "%{http_code}" --max-time 8 "$url"
}

PLUS_LANG_URL="$(echo "$LT_PLUS_ENDPOINT" | sed 's/\/check$/\/languages/')"
FREE_LANG_URL="$(echo "$LT_ENDPOINT" | sed 's/\/check$/\/languages/')"

PLUS_CODE="$(curl_quiet "$PLUS_LANG_URL")"
echo "  - Plus: ${PLUS_LANG_URL} → HTTP ${PLUS_CODE}"
FREE_CODE="$(curl_quiet "$FREE_LANG_URL")"
echo "  - Free: ${FREE_LANG_URL} → HTTP ${FREE_CODE}"

if [ "$PLUS_CODE" != "200" ] && [ "$FREE_CODE" != "200" ]; then
  echo "⚠ 無法連到 LT /languages（Plus/Free 都非 200）。稍後啟動後也可能檢查失敗。"
fi

# 4) 檢查 3000 連線占用
PORT=3000
if lsof -i TCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠ 連接埠 ${PORT} 已被佔用。若你知道是先前的 dev，請手動關閉或改用其它埠。"
  echo "  你也可改用：npm run dev -- -p 3001"
fi

# 5) 啟動 Next.js dev（turbopack, port 3000）並等待就緒
echo "• 啟動 Next.js (port ${PORT}) ..."
npm run dev -- -p "${PORT}" &

SERVER_PID=$!
sleep 0.5

echo "• 等待服務可用（最多 60 次嘗試）..."
READY=0
for i in {1..60}; do
  if curl -fsS "http://localhost:${PORT}/api/lt-health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ $READY -eq 1 ]; then
  echo "• 服務就緒，開啟瀏覽器：/essay-checker"
  # macOS
  open "http://localhost:${PORT}/essay-checker" 2>/dev/null || \
  # Linux
  xdg-open "http://localhost:${PORT}/essay-checker" 2>/dev/null || true
else
  echo "⚠ 等待逾時。請手動開啟：http://localhost:${PORT}/essay-checker"
fi

echo "───────── 開發伺服器已啟動（PID: $SERVER_PID）按 Ctrl+C 可停止 ─────────"
wait $SERVER_PID
