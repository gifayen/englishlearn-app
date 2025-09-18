#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   bash scripts/restore.sh          # 還原到「stable」標籤
#   bash scripts/restore.sh stable-20250910-153000  # 還原到指定歷史快照

cd "$(dirname "$0")/.."

TARGET_TAG="${1:-stable}"

echo "==> 還原到標籤：$TARGET_TAG"

# 安全提示：會丟失未提交變更
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "!! 這裡不是 Git 專案，無法還原"
  exit 1
fi

# 確認標籤存在
if ! git rev-parse "$TARGET_TAG" >/dev/null 2>&1; then
  echo "!! 找不到標籤：$TARGET_TAG"
  echo "   可用標籤："
  git tag --list "stable*"
  exit 1
fi

# 丟棄工作區修改，硬還原到標籤
git reset --hard "$TARGET_TAG"

echo "==> 原始碼已回復。清理 & 安裝依賴…"
# 清理 build，重新安裝（避免 lockfile 不一致）
rm -rf .next
if command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "!! 找不到 npm，請自行執行安裝依賴"
fi

echo "==> 還原完成！接著你可以："
echo "   npm run dev"
