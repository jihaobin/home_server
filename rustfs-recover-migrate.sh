#!/usr/bin/env bash

set -euo pipefail

RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-root}"
RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-}"

LIVE_DATA_VOLUME="${LIVE_DATA_VOLUME:-home_server_home_server_rustfs_data}"
LIVE_LOGS_VOLUME="${LIVE_LOGS_VOLUME:-home_server_home_server_rustfs_logs}"

BACKUP_DATA_VOLUME="${BACKUP_DATA_VOLUME:-rustfs_data_backup_$(date +%Y%m%d_%H%M%S)}"
BACKUP_LOGS_VOLUME="${BACKUP_LOGS_VOLUME:-rustfs_logs_backup_$(date +%Y%m%d_%H%M%S)}"

RESCUE_IMAGE="${RESCUE_IMAGE:-rustfs/rustfs:1.0.0-alpha.65}"
RESCUE_CONTAINER="${RESCUE_CONTAINER:-rustfs_rescue_backup}"

PROD_ENDPOINT="${PROD_ENDPOINT:-http://host.docker.internal:9000}"
RESCUE_ENDPOINT="${RESCUE_ENDPOINT:-http://host.docker.internal:19000}"

MC_CFG_VOLUME="${MC_CFG_VOLUME:-mc_cfg}"

SOURCE_BUCKETS_RAW="${SOURCE_BUCKETS:-files,chat-files}"
TARGET_BUCKETS_RAW="${TARGET_BUCKETS:-files-live,chat-files-live}"
TARGET_SUFFIX="${TARGET_SUFFIX:-}"

RUN_COMPOSE_DOWN_UP="${RUN_COMPOSE_DOWN_UP:-true}"
CLEANUP_RESCUE_ON_SUCCESS="${CLEANUP_RESCUE_ON_SUCCESS:-true}"


if [[ -z "${RUSTFS_SECRET_KEY}" ]]; then
    echo "错误: 必须设置 RUSTFS_SECRET_KEY" >&2
    echo "示例: RUSTFS_SECRET_KEY='xxx' bash rustfs-recover-migrate.sh" >&2
    exit 1
fi

if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* || "${MSYSTEM:-}" == MINGW* || "${MSYSTEM:-}" == MSYS* ]]; then
    export MSYS_NO_PATHCONV=1
    export MSYS2_ARG_CONV_EXCL='*'
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "错误: 未找到 docker 命令" >&2
    exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
else
    COMPOSE_CMD=(docker compose)
fi

split_csv() {
    local input="$1"
    local -n out_arr_ref=$2
    IFS=',' read -r -a out_arr_ref <<<"$input"
}

trim() {
    local s="$1"
    s="${s#${s%%[![:space:]]*}}"
    s="${s%${s##*[![:space:]]}}"
    printf "%s" "$s"
}

ensure_volume() {
    local volume="$1"
    if docker volume inspect "$volume" >/dev/null 2>&1; then
        echo "  卷已存在: $volume"
    else
        docker volume create "$volume" >/dev/null
        echo "  已创建卷: $volume"
    fi
}

copy_volume() {
    local src_volume="$1"
    local dst_volume="$2"

    echo "  清空目标卷: $dst_volume"
    docker run --rm -v "$dst_volume:/target" alpine sh -c 'mkdir -p /target && cd /target && rm -rf -- ./* ./.[!.]* ./..?* 2>/dev/null || true'

    echo "  复制 $src_volume -> $dst_volume"
    docker run --rm \
        -v "$src_volume:/from" \
        -v "$dst_volume:/to" \
        alpine sh -c 'cp -a /from/. /to/'
}

run_mc() {
    docker run --rm -v "$MC_CFG_VOLUME:/root/.mc" minio/mc "$@"
}

fail_with_access_hint() {
    local alias_name="$1"
    local bucket_name="$2"
    echo "错误: 无法访问目标桶 prod/$bucket_name（alias=$alias_name）" >&2
    echo "可能原因:" >&2
    echo "1) 该桶已存在且不属于当前 root 身份" >&2
    echo "2) 生产实例 AK/SK 与脚本参数不一致" >&2
    echo "3) 该桶继承了异常策略元数据" >&2
    echo "建议: 改用新的 TARGET_BUCKETS（例如带时间戳后缀）后重试" >&2
    exit 1
}

ensure_target_bucket_ready() {
    local bucket_name="$1"

    if run_mc ls "prod/$bucket_name" >/dev/null 2>&1; then
        return 0
    fi

    if ! run_mc mb --ignore-existing "prod/$bucket_name" >/dev/null 2>&1; then
        fail_with_access_hint "prod" "$bucket_name"
    fi

    if ! run_mc ls "prod/$bucket_name" >/dev/null 2>&1; then
        fail_with_access_hint "prod" "$bucket_name"
    fi
}

echo "=========================================="
echo "RustFS 恢复迁移脚本开始"
echo "=========================================="
echo "生产端点: $PROD_ENDPOINT"
echo "救援端点: $RESCUE_ENDPOINT"
echo "源桶: $SOURCE_BUCKETS_RAW"
echo "目标桶: $TARGET_BUCKETS_RAW"
echo "数据卷: $LIVE_DATA_VOLUME"
echo "日志卷: $LIVE_LOGS_VOLUME"
echo "备份数据卷: $BACKUP_DATA_VOLUME"
echo "备份日志卷: $BACKUP_LOGS_VOLUME"
echo

split_csv "$SOURCE_BUCKETS_RAW" SOURCE_BUCKETS
split_csv "$TARGET_BUCKETS_RAW" TARGET_BUCKETS

if [[ -n "$TARGET_SUFFIX" ]]; then
    for i in "${!TARGET_BUCKETS[@]}"; do
        TARGET_BUCKETS[$i]="$(trim "${TARGET_BUCKETS[$i]}")$TARGET_SUFFIX"
    done
    TARGET_BUCKETS_RAW="$(IFS=,; echo "${TARGET_BUCKETS[*]}")"
fi

if [[ ${#SOURCE_BUCKETS[@]} -ne ${#TARGET_BUCKETS[@]} ]]; then
    echo "错误: SOURCE_BUCKETS 与 TARGET_BUCKETS 数量不一致" >&2
    exit 1
fi

echo "[1/9] 检查源卷是否存在..."
docker volume inspect "$LIVE_DATA_VOLUME" >/dev/null
docker volume inspect "$LIVE_LOGS_VOLUME" >/dev/null
echo "  源卷检查通过"
echo

echo "[2/9] 停止 compose（用于一致性备份）..."
if [[ "$RUN_COMPOSE_DOWN_UP" == "true" ]]; then
    "${COMPOSE_CMD[@]}" down
else
    echo "  已跳过 compose down（RUN_COMPOSE_DOWN_UP=false）"
fi
echo

echo "[3/9] 创建并写入备份卷..."
ensure_volume "$BACKUP_DATA_VOLUME"
ensure_volume "$BACKUP_LOGS_VOLUME"
copy_volume "$LIVE_DATA_VOLUME" "$BACKUP_DATA_VOLUME"
copy_volume "$LIVE_LOGS_VOLUME" "$BACKUP_LOGS_VOLUME"
echo "  备份完成"
echo

echo "[4/9] 启动生产 compose..."
if [[ "$RUN_COMPOSE_DOWN_UP" == "true" ]]; then
    "${COMPOSE_CMD[@]}" up -d
else
    echo "  已跳过 compose up（RUN_COMPOSE_DOWN_UP=false）"
fi
echo

echo "[5/9] 启动救援容器（读取备份卷）..."
if docker ps -a --format '{{.Names}}' | grep -Fxq "$RESCUE_CONTAINER"; then
    echo "  检测到同名容器，先删除: $RESCUE_CONTAINER"
    docker rm -f "$RESCUE_CONTAINER" >/dev/null
fi

docker run -d \
    --name "$RESCUE_CONTAINER" \
    -p 19000:9000 \
    -p 19001:9001 \
    -v "$BACKUP_DATA_VOLUME:/data" \
    -v "$BACKUP_LOGS_VOLUME:/logs" \
    -e "RUSTFS_ACCESS_KEY=$RUSTFS_ACCESS_KEY" \
    -e "RUSTFS_SECRET_KEY=$RUSTFS_SECRET_KEY" \
    -e "RUSTFS_CONSOLE_ENABLE=true" \
    "$RESCUE_IMAGE" >/dev/null

echo "  等待救援容器启动..."
sleep 5
echo

echo "[6/9] 初始化 mc 连接..."
ensure_volume "$MC_CFG_VOLUME"
run_mc alias set prod "$PROD_ENDPOINT" "$RUSTFS_ACCESS_KEY" "$RUSTFS_SECRET_KEY" >/dev/null
run_mc alias set rescue "$RESCUE_ENDPOINT" "$RUSTFS_ACCESS_KEY" "$RUSTFS_SECRET_KEY" >/dev/null
run_mc ls prod >/dev/null
run_mc ls rescue >/dev/null
echo "  mc alias 初始化完成"
echo

echo "[7/9] 创建目标桶并执行迁移..."
for i in "${!SOURCE_BUCKETS[@]}"; do
    src="$(trim "${SOURCE_BUCKETS[$i]}")"
    dst="$(trim "${TARGET_BUCKETS[$i]}")"

    echo "  迁移: rescue/$src -> prod/$dst"
    ensure_target_bucket_ready "$dst"
    run_mc mirror --overwrite "rescue/$src" "prod/$dst"
done
echo

echo "[8/9] 对目标桶做读写删验证..."
for dst_raw in "${TARGET_BUCKETS[@]}"; do
    dst="$(trim "$dst_raw")"
    test_file="__rwtest_$(date +%s).txt"

    echo "  验证桶: prod/$dst"
    run_mc cp /etc/hosts "prod/$dst/$test_file" >/dev/null
    run_mc rm "prod/$dst/$test_file" >/dev/null
done
echo "  读写删验证通过"
echo

echo "[9/9] 输出迁移结果摘要..."
for i in "${!SOURCE_BUCKETS[@]}"; do
    src="$(trim "${SOURCE_BUCKETS[$i]}")"
    dst="$(trim "${TARGET_BUCKETS[$i]}")"

    echo "  统计源桶: rescue/$src"
    run_mc ls --recursive --summarize "rescue/$src"
    echo "  统计目标桶: prod/$dst"
    run_mc ls --recursive --summarize "prod/$dst"
done
echo

if [[ "$CLEANUP_RESCUE_ON_SUCCESS" == "true" ]]; then
    echo "清理救援容器: $RESCUE_CONTAINER"
    docker rm -f "$RESCUE_CONTAINER" >/dev/null
fi

echo
echo "=========================================="
echo "迁移成功完成"
echo "=========================================="
echo "请把业务桶名切换为: $TARGET_BUCKETS_RAW"
echo "备份卷保留用于回滚:"
echo "  - $BACKUP_DATA_VOLUME"
echo "  - $BACKUP_LOGS_VOLUME"
echo
