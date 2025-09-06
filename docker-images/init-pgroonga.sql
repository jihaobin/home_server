-- 初始化PGroonga扩展
-- 这个脚本会在数据库启动时自动执行

-- 创建PostGIS扩展（如果还没有的话）
CREATE EXTENSION IF NOT EXISTS postgis;

-- 创建PGroonga扩展
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- 验证扩展是否安装成功
SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'pgroonga');