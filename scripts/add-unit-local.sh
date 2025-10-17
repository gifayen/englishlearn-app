#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   scripts/add-unit-local.sh <level> <grade> <semester> <unit-number>
# 例：
#   scripts/add-unit-local.sh jhs g7 s1 01

if [ $# -lt 4 ]; then
  echo "用法: $0 <level> <grade> <semester> <unit-number>"
  exit 1
fi

LEVEL="$1"
GRADE="$2"
SEM="$3"
UNITNUM="$4"

SRC_JSON="content-drafts/${LEVEL}/${GRADE}/${SEM}/Unit${UNITNUM}.json"
SRC_IMAGES="content-drafts/${LEVEL}/${GRADE}/${SEM}/Unit${UNITNUM}Images"

if [ ! -f "${SRC_JSON}" ]; then
  echo "找不到來源 JSON：${SRC_JSON}"
  exit 2
fi

if [ -d "${SRC_IMAGES}" ]; then
  scripts/add-unit.sh "${LEVEL}" "${GRADE}" "${SEM}" "${UNITNUM}" "${SRC_JSON}" "${SRC_IMAGES}"
else
  scripts/add-unit.sh "${LEVEL}" "${GRADE}" "${SEM}" "${UNITNUM}" "${SRC_JSON}"
fi
