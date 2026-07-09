#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SOURCE_DIR="${1:-${SOURCE_DIR:-/e/home_server_data}}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$SOURCE_DIR")/home_server_backup_$(date +%Y%m%d_%H%M)}"
VOLUME_POSTGRES="${VOLUME_POSTGRES:-home_server_home_server_postgres_data}"
VOLUME_REDIS="${VOLUME_REDIS:-home_server_home_server_redis_data}"
VOLUME_RUSTFS_DATA="${VOLUME_RUSTFS_DATA:-home_server_home_server_rustfs_data}"
VOLUME_RUSTFS_LOGS="${VOLUME_RUSTFS_LOGS:-home_server_home_server_rustfs_logs}"

if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
else
    COMPOSE_CMD=(docker compose)
fi

# Git Bash / MSYS 会把 /target 这类参数错误转换成 Windows 路径，导致 docker 内部路径失效
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* || "${MSYSTEM:-}" == MINGW* || "${MSYSTEM:-}" == MSYS* ]]; then
    export MSYS_NO_PATHCONV=1
    export MSYS2_ARG_CONV_EXCL='*'
fi

normalize_path() {
    local path="$1"

    # 兼容 /path\subdir 这种混合路径，统一为 Linux 路径分隔符
    path="${path//\\//}"

    # 去掉末尾多余 /（保留根目录 /）
    while [ "$path" != "/" ] && [[ "$path" == */ ]]; do
        path="${path%/}"
    done

    printf "%s" "$path"
}

SOURCE_DIR="$(normalize_path "$SOURCE_DIR")"
BACKUP_DIR="$(normalize_path "$BACKUP_DIR")"

ensure_volume() {
    local volume="$1"
    if docker volume inspect "$volume" >/dev/null 2>&1; then
        echo "  卷已存在: $volume"
    else
        docker volume create "$volume" >/dev/null
        echo "  已创建卷: $volume"
    fi
}

copy_if_exists() {
    local src="$1"
    local volume="$2"
    local label="$3"

    src="$(normalize_path "$src")"

    if [ -d "$src" ]; then
        echo "  清理 $label 目标卷..."
        docker run --rm \
            -v "$volume:/target" \
            alpine:latest \
            sh -c 'mkdir -p /target && cd /target && rm -rf -- ./* ./.[!.]* ./..?* 2>/dev/null || true'

        echo "  复制 $label（目录内容）..."
        tar -C "$src" -cf - . | docker run --rm -i \
            -v "$volume:/target" \
            alpine:latest \
            tar -C /target -xf -
    else
        echo "  跳过 $label（目录不存在）"
    fi
}

echo "=========================================="
echo "RustFS 数据迁移脚本"
echo "从 $SOURCE_DIR 迁移到命名卷"
echo "=========================================="
echo

if [ ! -d "$SOURCE_DIR" ]; then
    echo "错误: 源目录不存在: $SOURCE_DIR" >&2
    exit 1
fi

echo "[1/6] 创建备份..."
mkdir -p "$BACKUP_DIR"
if command -v rsync >/dev/null 2>&1; then
    rsync -a "$SOURCE_DIR/" "$BACKUP_DIR/"
else
    cp -a "$SOURCE_DIR/." "$BACKUP_DIR/"
fi
echo "备份完成: $BACKUP_DIR"
echo

echo "[2/6] 停止所有容器..."
"${COMPOSE_CMD[@]}" down
echo

echo "[3/6] 创建新的命名卷..."
ensure_volume "$VOLUME_RUSTFS_DATA"
ensure_volume "$VOLUME_RUSTFS_LOGS"
ensure_volume "$VOLUME_REDIS"
ensure_volume "$VOLUME_POSTGRES"
echo

echo "[4/6] 复制 RustFS 数据到命名卷..."
copy_if_exists "$SOURCE_DIR/oss_data" "$VOLUME_RUSTFS_DATA" oss_data
copy_if_exists "$SOURCE_DIR/rustfs_logs" "$VOLUME_RUSTFS_LOGS" rustfs_logs
echo "  RustFS 数据复制完成"
echo

echo "[5/6] 复制 Redis 数据到命名卷..."
copy_if_exists "$SOURCE_DIR/redis_data" "$VOLUME_REDIS" redis_data
echo "  Redis 数据复制完成"
echo

echo "[6/6] 复制 PostgreSQL 数据到命名卷..."
copy_if_exists "$SOURCE_DIR/database_data" "$VOLUME_POSTGRES" database_data
echo "  PostgreSQL 数据复制完成"
echo

echo
echo "=========================================="
echo "数据迁移完成！"
echo "=========================================="
echo
echo "请按以下步骤操作："
echo "1. docker-compose.yaml 已使用同名命名卷；缺失时 Compose 会自动创建"
echo "2. 如果本脚本已迁移旧数据，Compose 会复用刚创建并写入数据的同名卷"
echo "3. 运行: ${COMPOSE_CMD[*]} up -d"
echo "4. 验证服务是否正常"
echo
echo "如果一切正常，可以删除旧数据: $SOURCE_DIR"
echo "备份位置: $BACKUP_DIR"
echo
