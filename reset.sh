#!/usr/bin/env bash
# reset.sh - 一鍵重置並啟動 Next.js (port=3000)

set -Eeuo pipefail

PORT=3000
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf "\033[1;36m%s\033[0m\n" "➤ $*"; }
ok()  { printf "\033[1;32m%s\033[0m\n" "✔ $*"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "⚠ $*"; }
err() { printf "\033[1;31m%s\033[0m\n" "✘ $*"; }

cd "$PROJECT_DIR"

log "專案路徑：$PROJECT_DIR"

# 1) Node 版本檢查（至少 18，建議 20+）
if command -v node >/dev/null 2>&1; then
  NODE_V_RAW="$(node -v || echo v0.0.0)"
  NODE_V="${NODE_V_RAW#v}"
  NODE_MAJOR="${NODE_V%%.*}"
  log "Node 版本：$NODE_V_RAW"
  if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
    err "Node 版本過舊（需要 ≥ 18，建議 20+）。請升級後再執行。"
    exit 1
  fi
else
  err "找不到 Node。請先安裝 Node.js（建議 v20 以上）。"
  exit 1
fi

# 2) 環境檔檢查
if [ ! -f ".env.local" ]; then
  warn ".env.local 不存在，幫你建立模板（請稍後自己補齊變數值）。"
  cat > .env.local <<'ENV_SAMPLE'
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# === LanguageTool ===
LT_ENDPOINT=https://languagetool.org/api/v2/check
LT_PLUS_ENDPOINT=https://api.languagetoolplus.com/v2/check
LT_API_KEY=
LT_TIMEOUT_MS=20000
LT_MAX_CHARS=320
LT_MAX_TOTAL_MATCHES=800
LT_PER_ENDPOINT_RETRIES=2
LT_RETRY_BASE_DELAY_MS=350
LT_FORCE_FALLBACK=0

# === OpenAI ===
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=20000
ENV_SAMPLE
  ok "已建立 .env.local（請補齊必要變數）"
fi

# 基礎變數提示（不阻擋啟動，但提醒）
source .env.local 2>/dev/null || true
[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && warn "NEXT_PUBLIC_SUPABASE_URL 尚未設定。"
[ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ] && warn "NEXT_PUBLIC_SUPABASE_ANON_KEY 尚未設定。"
[ -z "${OPENAI_API_KEY:-}" ] && warn "OPENAI_API_KEY 尚未設定（若你有用 GPT 檢查請補上）。"
[ -z "${LT_API_KEY:-}" ] && warn "LT_API_KEY 尚未設定（若你要用 LanguageTool Plus 請補上）。"

# 3) 關閉殘留 node / 釋放 3000 埠
log "停止殘留的 node 進程..."
pkill node 2>/dev/null || true

log "釋放埠口 :$PORT（若被佔用）..."
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti tcp:$PORT || true)"
  if [ -n "$PIDS" ]; then
    warn "埠 $PORT 被 PID: $PIDS 佔用，嘗試結束..."
    kill -9 $PIDS 2>/dev/null || true
    ok "已釋放 $PORT"
  fi
fi

# 4) 清理快取
log "清理 .next 與快取..."
rm -rf .next node_modules/.cache || true
ok "清理完成"

# 5) 安裝依賴
if [ -f package-lock.json ]; then
  log "偵測到 package-lock.json，執行 npm ci（確保版本一致）..."
  if ! npm ci; then
    warn "npm ci 失敗，改用 npm install 嘗試修正依賴..."
    npm install
  fi
else
  log "未找到 lock 檔，執行 npm install..."
  npm install
fi
ok "依賴安裝完成"

# 6) 啟動 Next.js on port 3000
log "以 port $PORT 啟動開發伺服器..."
APP_URL="http://localhost:$PORT"

# macOS 自動開啟瀏覽器（背景執行，不阻塞）
if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "$APP_URL") &
fi

# 直接用 package.json 的 script，但強制指定埠口
npm run dev -- -p "$PORT"
