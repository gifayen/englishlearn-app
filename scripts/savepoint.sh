#!/usr/bin/env bash
set -euo pipefail

# 進到專案根目錄（此檔位於 scripts/ 底下）
cd "$(dirname "$0")/.."

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TAG_MOVE="stable"            # 可重覆更新的「目前穩定版」標籤
TAG_SNAPSHOT="stable-$TIMESTAMP"

echo "==> Savepoint at $TIMESTAMP"

# 1) 建 backups/，備份當前 .env.local（如果存在）
mkdir -p backups
if [ -f ".env.local" ]; then
  cp .env.local "backups/.env.local.$TIMESTAMP"
  echo "   - .env.local 已備份到 backups/.env.local.$TIMESTAMP"
else
  echo "   - 找不到 .env.local（略過備份）"
fi

# 2) 初始化 git（如果還沒）
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
  echo "   - 已初始化 Git repo"
fi

# 3) 納入版本控制（忽略 .env.local、node_modules、.next 等 .gitignore 規則）
git add -A || true
# 若沒有變更，避免 commit 失敗
if ! git diff --cached --quiet; then
  git commit -m "savepoint: $TIMESTAMP"
  echo "   - 已建立 commit"
else
  echo "   - 沒有檔案變更可提交（跳過 commit）"
fi

# 4) 打兩個 tag：一個會覆蓋（stable），一個保留歷史（stable-yyyymmdd-hhmmss）
#    若 TAG_MOVE 已存在，用 -f 覆蓋
if git rev-parse "$TAG_MOVE" >/dev/null 2>&1; then
  git tag -f "$TAG_MOVE"
else
  git tag "$TAG_MOVE"
fi
git tag "$TAG_SNAPSHOT"

echo "==> 完成！"
echo "   - 最新穩定標籤：$TAG_MOVE"
echo "   - 歷史快照標籤：$TAG_SNAPSHOT"
