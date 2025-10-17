#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   scripts/add-unit.sh <level> <grade> <semester> <unit-number> <source-json> [images-folder]
# 例：
#   scripts/add-unit.sh jhs g7 s1 01 content-drafts/jhs/g7/s1/Unit01.json content-drafts/jhs/g7/s1/Unit01Images

if [ $# -lt 5 ]; then
  echo "用法: $0 <level> <grade> <semester> <unit-number> <source-json> [images-folder]"
  exit 1
fi

LEVEL="$1"      # elem | jhs | shs
GRADE="$2"      # g3 | g7 | g10 | ...
SEM="$3"        # s1 | s2
UNITNUM="$4"    # 01 | 02 | 03 ...
SRC_JSON="$5"   # 來源 JSON 檔
SRC_IMAGES="${6:-}"  # (可選) 圖片資料夾

DEST_DIR="data/texts/${LEVEL}/${GRADE}/${SEM}/unit-${UNITNUM}"
DEST_JSON="${DEST_DIR}/unit.json"

mkdir -p "${DEST_DIR}/images"

if [ ! -f "${SRC_JSON}" ]; then
  echo "找不到來源 JSON：${SRC_JSON}"
  exit 2
fi

cp "${SRC_JSON}" "${DEST_JSON}"
echo "已複製 JSON → ${DEST_JSON}"

if [ -n "${SRC_IMAGES}" ] && [ -d "${SRC_IMAGES}" ]; then
  cp -R "${SRC_IMAGES}/." "${DEST_DIR}/images/"
  echo "已複製圖片 → ${DEST_DIR}/images/"
fi

echo "完成：${DEST_DIR}"
