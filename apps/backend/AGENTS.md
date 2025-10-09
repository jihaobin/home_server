# Backend Agents 指南

## 总是使用中文进行输出

## 快速概览

- 基于 NestJS 11 的 REST API，入口位于 `src/main.ts`，全局前缀为 `api`
- 认证由自定义 `AuthModule` 托管，底层集成 better-auth，并在 `/api/auth/*` 暴露统一入口
- 数据持久化使用 Drizzle ORM + PostgreSQL，schema 保存在 `src/common/database/schema`
- 缓存、限流等横切能力集中在 `src/common`（Redis 缓存、全局异常过滤器、响应转换拦截器、Winston 日志等）
- Swagger/Scalar 文档通过 `setupScalarSwagger` 自动挂载在 `/api-docs`

## 目录速查

- `src/app.module.ts`：聚合 Database/Logger/Cache/Exceptions/Interceptors/Auth/业务模块
- `src/common/`：基础设施层（数据库、缓存、日志、邮件、Swagger 模型、装饰器、校验工具）
- `src/modules/`：领域模块，当前覆盖地址、实名认证、服务/服务人员、订单、支付等子域
- `src/lib/`：第三方 SDK 封装（例如腾讯地图客户端与辅助工具）
- `drizzle/`：Drizzle 迁移输出目录，配置位于根目录 `drizzle.config.ts`

## 开发与调试

- 初始化：在仓库根目录执行 `pnpm install`
- 本地开发：
  - 全图监视：`pnpm dev`
  - 仅后端：`pnpm backend:dev` 或在 `apps/backend` 内执行 `pnpm run dev`
- 调试模式：`pnpm run start:debug`（自动加载 `.env.development`，启用 Nest inspector）
- 生产预览：`pnpm run build && pnpm run start:prod`
- 依赖环境：本地需提供 PostgreSQL、Redis、SMTP 以及第三方 OAuth/支付沙箱服务，可通过 `docker-compose up` 在仓库根目录拉起基础设施

## 环境变量管理

- `.env.development` / `.env.production` 仅存放示例值，切勿提交带有真实密钥的文件
- 推荐用 `pnpm env:setup` 合成各环境片段，或通过 `dotenvx run -f <env-file> -- <command>` 临时注入变量
- 关键变量：`DATABASE_URI`、`TRUSTED_ORIGINS`、`BETTER_AUTH_SECRET`、`MAIL_*`、`GITHUB_CLIENT_*`、`WECHAT_CLIENT_*`、`MEILI_*`、`TMAP_*`、`ALI_*` 等，执行前请确认全部配置
- 认证域白名单会被 `main.ts` 拆分为数组，请使用逗号分隔并含协议前缀

## 数据库与迁移

- Drizzle ORM 通过 `src/common/database/db.ts` 管理连接，`setLogWriter` 可将日志接入自定义通道
- 迁移流程：
  - 生成：`pnpm run db:generate`
  - 执行：`pnpm run db:migration`
  - 一次性生成并迁移：`pnpm run db:generate:migrate`
- 迁移脚本输出至 `apps/backend/drizzle`，提交时请同时包含 SQL 文件
- Schema 由 `src/common/database/schema/index.ts` 汇总，新增表/字段后记得导出，并保持 `snake_case` 命名以匹配 `casing: "snake_case"`

## 认证与会话

- `AuthModule` 使用 better-auth + Drizzle 适配器，默认路由基于 `basePath` (`/api/auth`) 自动代理到 Express 原始处理器
- 邮件通知依赖 `MailService`（QQ SMTP 示例），包括注册验证、重置密码等；未配置将抛错
- 支持邮箱密码登录、GitHub OAuth、WeChat OAuth，社交登录回调会通过自定义 `/auth/wechat/*` 控制器下发用户信息
- 会话基于 Cookie + Session，默认有效期 30 天，`trustedOrigins` 会控制允许的跨域来源
- 新增认证 Hook 时，使用 `@BeforeHook` / `@AfterHook` 元数据，模块初始化会自动桥接到 better-auth 中间件

## 横切能力

- 日志：`LoggerModule` 封装 Winston + daily-rotate-file，开发态输出彩色详细日志，生产态 JSON；通过 `AppLoggerService` 注入并与 Drizzle `logWriter` 打通
- 缓存：`CacheModule` 默认启用 `ioredis`（本地 `localhost:6379`），需要在部署环境更新主机/凭据
- 异常：`HttpExceptionFilter` 统一格式化异常，`ExceptionsModule.forRoot` 会在 `main.ts` 中全局挂载；返回结构与 Swagger `SwaggerModels` 对齐
- 拦截器：`InterceptorsModule` 开启数据包装（成功消息默认为“操作成功”）和可配置超时控制，处理链依赖 Nest 全局拦截器
- Swagger：`setupScalarSwagger` 通过 Scalar UI 展示接口文档，地址 `/api-docs`；Better-Auth 的 Reference 文档由插件生成在 `/api/auth/reference`

## 业务模块现状

- 地址/城市：封装在 `modules/address` 与 `schema/china-city`，依赖腾讯地图工具进行地理编码
- 服务与人员：`modules/service`、`modules/service-personnel` 聚焦业务资源、技能、人员档案
- 实名认证：`modules/user-auth-real-name` 承载实名认证流程，通常结合外部核身服务（占位实现）
- 订单与支付：`modules/order`、`modules/pay` 提供下单与支付能力；支付模块目前为雏形，待接入 Alipay/WeChat 支付 SDK 并补全验签逻辑
- 工作技能：`modules/work-skill` 管理技能标签/枚举，对外提供 CRUD 接口

## 类型定义

- 集中存放在`packages/types`子仓库中
- 类型的新增和修改都需要在`packages/types`子仓库中进行

## 测试策略

- 单元测试：使用 Jest，测试文件放在相同目录下的 `*.spec.ts`
- 常用指令：`pnpm run test`、`pnpm run test:watch`、`pnpm run test:e2e`
- 仓库根目录可通过 `pnpm test --filter=backend` 聚焦后端；提交前请至少跑通相关用例
- 若新增模块涉及数据库，请提供基于 Drizzle 的测试夹具并注意清理状态

## 代码风格与静态检查

- 代码格式：遵循 `.editorconfig`（CRLF、4 空格），但 Biome 配置了 `tab` 缩进与双引号，保存前请运行 `pnpm format:check`
- Lint：使用仓库共享的 ESLint preset；`pnpm run lint` 默认带 `--fix`
- 类型检查：`pnpm run type-check`
- 提交前建议执行：`pnpm lint && pnpm type-check && pnpm test --filter=backend`

## 常见注意事项

- `NestFactory.create` 传入 `bodyParser: false` 为了兼容 better-auth 的原始请求体需求，如果需要使用内置解析器请在特定路由手动启用
- 全局前缀排除了 `/api/auth/{*path}`，新增路由时请确认是否应暴露在认证命名空间之外
- Drizzle 适配器默认 `generateId: false`，数据库层需要自行保证主键生成（见 `schema/createId`）
- 当新增 Redis 依赖或外部 SDK 时，请在 `CacheModule.registerAsync` 或 `lib/` 下集中封装，避免在业务层直接初始化客户端
- 所有第三方密钥（邮件、OAuth、支付、地图、阿里云）都必须通过环境变量注入，不要硬编码在源码中

## 进一步阅读

- `src/common/exceptions/README.md`：异常处理设计说明
- `src/common/mail/templates/`：邮件模板示例
- `README-tencent-map.md`：腾讯地图 API 约定
- better-auth 官方文档：<https://better-auth.vercel.app/>
- NestJS 官方文档：<https://docs.nestjs.com>
