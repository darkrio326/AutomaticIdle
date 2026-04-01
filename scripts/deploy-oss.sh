#!/usr/bin/env bash
set -euo pipefail

# One-click deploy to Alibaba Cloud OSS for static site.
# Deployment target is read from environment variables or a local .env file.
#
# Usage examples:
#   cp .env.example .env.local
#   npm run deploy:oss
#   RUN_BUILD=0 npm run deploy:oss
#   OSS_BUCKET=my-bucket OSS_ENDPOINT=oss-cn-your-region.aliyuncs.com npm run deploy:oss
#   DRY_RUN=1 npm run deploy:oss

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

load_env_file() {
  local env_file="$1"

  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/.env.local"

OSS_BUCKET="${OSS_BUCKET:-}"
OSS_ENDPOINT="${OSS_ENDPOINT:-}"
OSS_PREFIX="${OSS_PREFIX:-}"
RUN_BUILD="${RUN_BUILD:-1}"
DELETE_REMOTE="${DELETE_REMOTE:-0}"
DRY_RUN="${DRY_RUN:-0}"

if [[ ! -f package.json ]]; then
  echo "[ERROR] 未在项目根目录找到 package.json"
  exit 1
fi

if [[ -z "$OSS_BUCKET" || -z "$OSS_ENDPOINT" ]]; then
  echo "[ERROR] 缺少部署目标配置。"
  echo "        请在 .env/.env.local 中设置 OSS_BUCKET 与 OSS_ENDPOINT，或在命令前显式传入。"
  echo "        参考模板: .env.example"
  exit 1
fi

if [[ "$RUN_BUILD" == "1" ]]; then
  echo "[INFO] 构建生产包..."
  npm run build
else
  echo "[INFO] 跳过构建（RUN_BUILD=${RUN_BUILD}）"
fi

if [[ ! -d dist ]]; then
  echo "[ERROR] dist 目录不存在，请先构建。"
  exit 1
fi

target="oss://${OSS_BUCKET}/"
if [[ -n "$OSS_PREFIX" ]]; then
  target="oss://${OSS_BUCKET}/${OSS_PREFIX%/}/"
fi

args=(sync dist/ "$target" --update --force --endpoint "$OSS_ENDPOINT")
if [[ "$DELETE_REMOTE" == "1" ]]; then
  args+=(--delete)
fi

echo "[INFO] 上传目标: $target"
echo "[INFO] Endpoint: $OSS_ENDPOINT"
if [[ "$DELETE_REMOTE" == "1" ]]; then
  echo "[INFO] 远端清理: 开启 (--delete)"
else
  echo "[INFO] 远端清理: 关闭"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY_RUN] ossutil ${args[*]}"
  exit 0
fi

if ! command -v ossutil >/dev/null 2>&1; then
  echo "[ERROR] ossutil 未安装或不在 PATH 中。"
  echo "        请先安装并执行: ossutil config"
  exit 1
fi

ossutil "${args[@]}"

echo "[DONE] 部署完成。"
