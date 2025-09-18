#!/usr/bin/env bash
# 請直接複製貼上
set -euo pipefail

msg="${1:-""}"
ts="$(date +"%Y%m%d-%H%M%S")"
name="chk-$ts"

# 1) 確保是 git 專案
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi

# 2) 全量存檔並建立 commit
git add -A
git commit --allow-empty -m "checkpoint: ${msg:-$name}"

# 3) 建立唯一 tag
if git rev-parse "$name" >/dev/null 2>&1; then
  name="${name}-$(date +%s)"
fi
git tag -a "$name" -m "checkpoint: ${msg:-$name}"

# 4) 建立 snapshots 夾，備份 .env.local，並壓縮快照
mkdir -p "snapshots/$name"
if [[ -f ".env.local" ]]; then
  cp ".env.local" "snapshots/$name/.env.local"
fi

zip -r -q "snapshots/$name.zip" . -x \
  "node_modules/*" ".next/*" ".git/*" "snapshots/*"

echo "✅ 已建立還原點：$name"
echo "   - 追蹤檔案可用：git checkout -f $name  還原"
echo "   - .env.local 可用：cp snapshots/$name/.env.local .env.local  還原"
