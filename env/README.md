# 环境变量管理指南

## 📁 目录结构

```
env/
├── development/           # 开发环境配置
│   ├── .env.api          # Backend项目专用配置
│   ├── .env.admin          # Admin Web项目专用配置
│   ├── .env.mobile       # 移动端共享配置（mobile-user + mobile-worker）
│   ├── .env.mobile-user  # 用户端移动端特有配置
│   ├── .env.mobile-worker # 服务人员端移动端特有配置
│   └── .env.common       # 公共配置
├── production/           # 生产环境配置
│   ├── .env.api          # Backend项目专用配置
│   ├── .env.admin          # Admin Web项目专用配置
│   ├── .env.mobile       # 移动端共享配置（mobile-user + mobile-worker）
│   ├── .env.mobile-user  # 用户端移动端特有配置
│   ├── .env.mobile-worker # 服务人员端移动端特有配置
│   └── .env.common       # 公共配置
├── scripts/              # 管理脚本
│   └── setup-env-links.js # 环境变量软连接设置脚本
└── README.md            # 本文档
```

## 🚀 使用方法

### 自动环境切换

项目已配置为根据不同的命令自动加载对应环境的配置：

```bash
# 开发环境 - 自动加载 .env.development
pnpm dev

# 生产环境 - 自动加载 .env.production
pnpm build
pnpm start

# 启动特定应用（自动使用对应环境变量）
pnpm backend:dev
pnpm admin:dev
pnpm mobile-user:dev
pnpm mobile-worker:dev
```

### 手动指定环境

```bash
# 手动指定开发环境
npx dotenvx run -f .env.development -- your-command

# 手动指定生产环境
npx dotenvx run -f .env.production -- your-command
```

### 项目级别的环境变量

每个子项目都有自己的环境变量文件：

- `apps/backend/.env.development` - Backend开发环境配置
- `apps/backend/.env.production` - Backend生产环境配置
- `apps/admin-web/.env.development` - Admin Web开发环境配置
- `apps/admin-web/.env.production` - Admin Web生产环境配置
- `apps/mobile-user/.env.development` - Mobile User开发环境配置
- `apps/mobile-user/.env.production` - Mobile User生产环境配置
- `apps/mobile-worker/.env.development` - Mobile Worker开发环境配置
- `apps/mobile-worker/.env.production` - Mobile Worker生产环境配置

## 🔧 配置管理

### 添加新的环境变量

1. **Backend项目专用变量**: 编辑 `env/development/.env.api` 或 `env/production/.env.api`
2. **Admin Web项目专用变量**: 编辑 `env/development/.env.admin` 或 `env/production/.env.web`
3. **移动端共享变量**: 编辑 `env/development/.env.mobile` 或 `env/production/.env.mobile`
4. **用户端移动端特有变量**: 编辑 `env/development/.env.mobile-user` 或 `env/production/.env.mobile-user`
5. **服务人员端移动端特有变量**: 编辑 `env/development/.env.mobile-worker` 或 `env/production/.env.mobile-worker`
6. **公共变量**: 编辑 `env/development/.env.common` 或 `env/production/.env.common`

### 重新生成环境变量文件

```bash
# 重新设置所有项目的环境变量文件
pnpm env:setup
```

### 添加新项目

在 `env/scripts/setup-env-links.js` 中的 `ENV_CONFIG` 对象中添加新项目配置：

```javascript
const ENV_CONFIG = {
  // 现有配置...

  // 新项目配置
  'apps/new-project': {
    development: ['env/development/.env.new-project', 'env/development/.env.common'],
    production: ['env/production/.env.new-project', 'env/production/.env.common']
  }
};
```

## 🔒 安全最佳实践

### 1. 敏感信息管理

- ✅ 开发环境可以包含测试用的敏感信息
- ❌ 生产环境的敏感信息应该通过CI/CD或容器环境变量注入
- ✅ 使用 `dotenvx encrypt` 加密敏感配置

### 2. 版本控制

- ✅ 提交 `env/` 目录下的配置文件模板
- ❌ 不要提交包含真实敏感信息的生产环境配置
- ✅ 使用 `.env.example` 文件作为配置模板

### 3. 环境隔离

- ✅ 每个项目只能访问被授权的环境变量
- ✅ 开发和生产环境完全隔离
- ✅ 使用不同的数据库、API密钥等

## 🛠️ 故障排除

### 环境变量未加载

1. 检查是否运行了 `pnpm env:setup`
2. 确认环境变量文件存在且格式正确
3. 检查命令是否使用了正确的 dotenvx 前缀

### 变量冲突

1. 检查是否有重复的变量定义
2. 确认变量优先级：项目专用 > 公共配置
3. 使用 `npx dotenvx get --all` 查看所有加载的变量

### 权限问题

1. 确保脚本有执行权限
2. 检查文件路径是否正确
3. 确认目录结构完整

## 📚 相关命令

```bash
# 查看所有环境变量
npx dotenvx get --all

# 查看特定变量
npx dotenvx get VARIABLE_NAME

# 设置环境变量
npx dotenvx set VARIABLE_NAME "value"

# 加密环境变量文件
npx dotenvx encrypt

# 解密环境变量文件
npx dotenvx decrypt
```

## 🔄 更新流程

1. 修改 `env/` 目录下的配置文件
2. 运行 `pnpm env:setup` 重新生成项目环境变量文件
3. 重启开发服务器或重新部署应用

---

💡 **提示**: 这个环境变量管理系统确保了每个项目只能访问被授权的环境变量，同时支持根据不同的启动命令自动切换环境配置。
