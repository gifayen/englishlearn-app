#!/usr/bin/env bash
# 請直接複製貼上
set -euo pipefail

name="${1:-}"
if [[ -z "$name" ]]; then
  echo "用法：bash restore.sh <checkpoint-tag>（例如：bash restore.sh chk-20250912-1530）"
  exit 1
fi

git checkout -f "$name"

if [[ -f "snapshots/$name/.env.local" ]]; then
  cp "snapshots/$name/.env.local" .env.local
  echo "🔐 已還原 .env.local"
else
  echo "（沒有找到 snapshots/$name/.env.local，略過還原 .env.local）"
fi

echo "✅ 還原完成。建議執行：npm ci && npm run dev"
