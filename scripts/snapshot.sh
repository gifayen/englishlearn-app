#!/usr/bin/env bash
set -euo pipefail

# === 基本設定 ===
ROOT="$(pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/snapshots/$TS"
ZIP_OUT="$ROOT/snapshots/$TS.tgz"

mkdir -p "$OUT_DIR"

log() { printf "▶ %s\n" "$*" ; }
warn() { printf "⚠ %s\n" "$*" ; }

# === 小工具：安全複製（如檔案存在才複製，並建立目的目錄） ===
cp_safe() {
  local SRC="$1"
  if [ -f "$SRC" ]; then
    mkdir -p "$OUT_DIR/$(dirname "$SRC")"
    cp "$SRC" "$OUT_DIR/$SRC"
  fi
}

# === 1) 環境與版本資訊 ===
log "收集環境資訊…"
{
  echo "Timestamp: $TS"
  echo "Working dir: $ROOT"
  echo "Node: $(command -v node >/dev/null 2>&1 && node -v || echo 'N/A')"
  echo "npm:  $(command -v npm  >/dev/null 2>&1 && npm -v  || echo 'N/A')"
  echo "pnpm: $(command -v pnpm >/dev/null 2>&1 && pnpm -v || echo 'N/A')"
  echo "yarn: $(command -v yarn >/dev/null 2>&1 && yarn -v || echo 'N/A')"
  echo "OS:   $(uname -a 2>/dev/null || echo 'N/A')"
} > "$OUT_DIR/system.txt" || true

# Next.js 版本
if command -v npx >/dev/null 2>&1; then
  npx --yes next --version > "$OUT_DIR/next-version.txt" 2>/dev/null || true
fi

# npm 依賴樹（頂層）
if [ -f package.json ]; then
  (npm ls --depth=0 || true) > "$OUT_DIR/npm-ls.txt" 2>&1 || true
fi

# === 2) 遮罩後的 .env.local ===
if [ -f ".env.local" ]; then
  log "遮罩 .env.local（不外流明文金鑰）…"
  awk '
    BEGIN{FS="="; OFS="="}
    /^\s*#/ {print; next}
    /^[[:space:]]*$/ {print; next}
    {
      key=$1
      # 取得等號後整串值（保留原本等號右側的所有內容）
      sub(/^[^=]*=/,"",$0)
      val=$0
      # 遮罩：超過12字元 => 顯示前6字 + "…"
      if (length(val)>12) {
        print key"="substr(val,1,6)"…"
      } else {
        print key"="val
      }
    }
  ' ".env.local" > "$OUT_DIR/env.local.masked"
else
  warn ".env.local 不存在，略過環境快照。"
fi

# === 3) 關鍵檔案快照 ===
log "複製關鍵檔案…"
# 根設定 / 鎖檔
cp_safe "package.json"
cp_safe "package-lock.json"
cp_safe "pnpm-lock.yaml"
cp_safe "yarn.lock"
cp_safe "tsconfig.json"
cp_safe "next.config.js"
cp_safe "next.config.mjs"
cp_safe "next.config.ts"
cp_safe ".eslintrc"
cp_safe ".eslintrc.js"
cp_safe ".eslintrc.cjs"
cp_safe ".prettierrc"
cp_safe "tailwind.config.js"
cp_safe "postcss.config.js"

# 常用程式碼檔（若存在就會收）
cp_safe "app/layout.tsx"
cp_safe "app/page.tsx"
cp_safe "app/_components/AuthRefresher.tsx"
cp_safe "middleware.ts"
cp_safe "middleware.js"
cp_safe "lib/supabaseClient.ts"
cp_safe "config/features.ts"
cp_safe "app/essay-checker/page.tsx"
cp_safe "app/essay-checker/ui/EssayClient.tsx"
cp_safe "app/api/check/route.ts"
cp_safe "app/api/gpt-rewrite/route.ts"
cp_safe "app/api/lt-health/route.ts"
cp_safe "app/auth/signout/route.ts"
cp_safe "app/auth/login/page.tsx"
cp_safe "app/auth/signup/page.tsx"

# === 4) 本地健康檢查（若 dev server 開著才會嘗試） ===
log "嘗試擷取本地健康檢查（若 3000 未啟動會略過）…"
if curl -sSf "http://localhost:3000/" >/dev/null 2>&1; then
  mkdir -p "$OUT_DIR/health"
  curl -sS "http://localhost:3000/api/lt-health" > "$OUT_DIR/health/lt-health.json" 2>/dev/null || true
  curl -sS -X POST "http://localhost:3000/api/check" \
       -H "Content-Type: application/json" \
       --data '{"text":"This is a smol test. I goes to school yesterday however I forget bring my book.","language":"en-US","level":"picky"}' \
       > "$OUT_DIR/health/check-sample.json" 2>/dev/null || true
  # GPT 改寫（只會回傳錯誤或短訊息，避免實際扣費；如需可改成真的測）
  curl -sS -X POST "http://localhost:3000/api/gpt-rewrite" \
       -H "Content-Type: application/json" \
       --data '{"text":"Short test for rewrite."}' \
       > "$OUT_DIR/health/gpt-rewrite-sample.json" 2>/dev/null || true
else
  warn "http://localhost:3000 無回應，略過健康檢查。"
fi

# === 5) 專案樹（只列出前兩層，避免太大） ===
log "匯出專案樹（前兩層）…"
( command -v tree >/dev/null 2>&1 && tree -L 2 -a || find . -maxdepth 2 -print ) > "$OUT_DIR/tree.txt" 2>/dev/null || true

# === 6) 打包 ===
log "建立壓縮檔…"
tar -czf "$ZIP_OUT" -C "$ROOT/snapshots" "$TS" || true

# === 7) 快照說明 ===
cat > "$OUT_DIR/README.txt" <<EOF
Snapshot: $TS

包含：
- system.txt、next-version.txt、npm-ls.txt：版本與依賴資訊
- env.local.masked：遮罩後的 .env.local（不包含明文金鑰）
- 若存在：package.json、鎖檔、tsconfig、next.config、middleware、lib/supabaseClient.ts
- essay-checker 主要檔：app/essay-checker/page.tsx、ui/EssayClient.tsx、/api/check、/api/gpt-rewrite、/api/lt-health
- health/：在 dev server 開啟時的本地 API 測試結果
- tree.txt：專案前兩層結構
- 此資料夾已被打包為 $ZIP_OUT

回滾方式（手動）：將需要的檔案從 snapshots/$TS/ 對應路徑拷回專案根目錄。
EOF

log "完成 ✅"
echo "資料夾：$OUT_DIR"
echo "壓縮檔：$ZIP_OUT"
