# 师傅端功能与后台能力审计（2025-11-11）

## 1. 背景与目标

- **对象**：`apps/mobile-worker` 近期已完成的页面与流程（见 `work.md`）
- **目的**：梳理 `apps/backend` 现有模块对师傅端需求的覆盖程度，明确缺口、风险与下一步工作计划
- **范围**：实名认证、服务人员管理、订单全链路、支付提现、文件与评价、通知等模块，辅以近期调研的 NestJS + Drizzle 最佳实践

## 2. 模块全景概览

| 模块 | 主要职责 | 当前能力 | 风险/缺口 |
| --- | --- | --- | --- |
| `user-auth-real-name` | 身份证校验 + 用户实名资料 | 支持阿里云接口校验、实名信息 CRUD；服务层直接持有 `Client` | `api.ts` 硬编码密钥；`@Get(':userId')` 实际读取 `@Param('id')` 造成取值错误；缺少风控/限频 |
| `service-personnel` | 服务人员智能筛选、服务详情 | 多条件筛选、距离计算、定价选取、评价统计、排班判断完整 | 仅返回客户侧检索，缺少“我的订单/任务”入口；排序权重尚未针对评分权重做 A/B |
| `service` | 服务分类与项目 | 分类 CRUD、项目 CRUD、统计接口齐备 | 缺少上下架审核流；接口默认向所有角色开放，需补权限 |
| `work-skill` | 师傅资料、技能、定价 | 支持资料 upsert、技能批量维护、定价管理、已占用时段查询 | 错误信息直接抛出，缺少 HTTP 语义化；缺少资质图片上传流程 |
| `order` + `order-checkin` | 订单、扫码核验 | 客户下单、指派、撤销、完成、核验二维码、位置校验 | **缺失师傅视角**：无法领取/拒绝订单、无法查看我的订单列表；取消接口仅校验客户；通知模块为空 |
| `pay` | 支付、对账、收益、提现 | 集成支付宝 App 支付、异步通知、状态轮询、收益入账、提现到支付宝 | 账号绑定未实现；缺少对微信渠道支持；存在硬编码回调地址；提现依赖支付宝实名认证流程尚未打通 |
| `address` | 地址簿、腾讯地图 | CRUD、反向地理、周边地点 + 缓存、邻居统计 | 腾讯 Key 与限流策略需落地；地址默认公开访问需确认 |
| `files` | 对象存储、缩略图 | 去重、引用计数、缓存、BlurHash、预签名 URL | 清理任务尚未接入；公共/私有策略待配置 |
| `review` | 评价、统计 | 评价创建、统计聚合、图片加载、好评率 | 缺少针对师傅端的“待评价/追加评价”接口 |
| `notification` | 计划推送 | 目录为空 | **尚未实现订单推送、通知订阅、消息确认** |

## 3. 师傅端需求对照

| 师傅端需求（`work.md`） | 后台实现情况 | 判定 | 后续动作 |
| --- | --- | --- | --- |
| 接收新订单通知 | `modules/notification` 为空；`order` 未触发推送 | ❌ | 落地事件驱动消息（建议：订单状态 -> Notification Service -> Expo/短信） |
| 扫码验证订单 | `order-checkin` 生成/撤销二维码、校验到场、锁定距离 | ✅ | 补充异常处理（扫码超时、重复核验日志）并回传给推送体系 |
| 填写实名认证（身份证号） | `user-auth-real-name` 支持实名上送、调用阿里云校验 | ✅ | 修复 Controller `@Param`；将 `Client` 密钥迁移至 ENV；补充失败重试/审计日志 |
| 服务人员信息（姓名、年限、提供服务/规格/定价/时长、说明、区域、手机号、头像） | `work-skill` + `service-personnel` + `files` 覆盖基础信息、技能、定价、地理位置 | ✅ | 移动端已支持资料编辑（头像/简介/服务区域/工作时间/服务日）与资质图片预览，数据通过聚合接口脱敏回传 |
| 查看/管理订单 & 服务人员取消订单 | `order` 支持客户/服务人员双视角，预约即默认接单，无法履约时统一走取消流程 | ✅ 完成 | 后端开放 `GET /order/assignments/me`、`POST /order/:id/cancel`（客户/师傅均可），并允许指派师傅调用 `GET /order/:id`、`POST /order/:id/complete` |
| 查看收支明细与记录 | `pay` 维护 `financialTransactions`、`earnings`、`userBalances` 并支持查询 | ✅ | 需聚合露出 API（当前仅存储层可用）；提供按月统计 |
| 提现到支付宝/微信 + 绑定账号 | `pay.withdraw` 支持支付宝提现；未实现账号绑定、微信渠道 | ⚠️ | 拆分为：1）账号授权绑定（调用 `alipay.open.auth`）；2）提现前校验绑定；3）设计多渠道策略 |
| 提现输入金额 | `pay.withdraw` 已校验余额并冻结金额 | ✅ | UI 需照顾 `Decimal` 精度提示 |

## 4. 关键问题与风险

1. **安全合规**
   - `user-auth-real-name/api.ts` 暴露了阿里云 `appKey/appSecret`，需立即迁移到环境变量并限制脚本访问
   - 支付回调地址硬编码为测试域名（`natappfree.cc`），上线前需参数化
   - 地址、文件等接口缺少角色鉴权，需结合 `AuthGuard` 与 `Public/Optional` 装饰器加固

2. **核心功能缺失**
   - 师傅订单流转接口与通知体系尚未实现，导致“接单/拒单/超时提醒/到账通知”无法落地
   - 账号绑定（支付宝/微信）缺失，提现流程存在断点
   - `notification` 模块空缺，Expo/FCM/短信策略未定

3. **可靠性改进点**
   - 实名接口缺少熔断/限频；日志仅 `console.log`
   - 筛选排序依赖 SQL，需结合观测指标验证性能（`ST_DWithin`、窗口函数）
   - `files` 去重逻辑已有事务保护，但物理删除任务未启用

## 5. 外部最佳实践摘要（NestJS + Drizzle）

- **模块化连接管理**（Trilon《NestJS & DrizzleORM: A Great Match》，GitHub `@sixaphone/nestjs-drizzle`）
  - 使用 `DrizzleModule.forRoot/forFeature` 管理多连接，统一在 `AppModule` 配置并借助 `InjectClient`/`InjectRepository` 提升类型安全
  - 建议拆分 `database/` 目录：`schema/`、`constants.ts`、`drizzle.module.ts`，避免 Service 直接依赖原生 `DB`

- **Schema 与类型集中维护**（mithle.sh《How to use Drizzle ORM with NestJS》）
  - 将所有表定义集中在 `schema.ts` 或按域拆分，导出 `typeof schema` 供 Repository 层推导，减少魔法字符串
  - 通过 `InferSelectModel` 或 `$inferSelect/$inferInsert` 明确 DTO 类型，保持接口与数据库同步

- **仓储模式与事务化**（Medium《Repository Pattern in Nest.js with Drizzle ORM》）
  - 在 Repository 层封装常用查询，使用 `DrizzleRepository` 减少重复 SQL
  - 统一通过 `drizzleClient.transaction(tx => ...)` 处理复合操作，避免在 Service 嵌套多次事务

- **查询优化与分页**（Drizzle 官方文档）
  - 充分利用 `.select({})` 局部字段、`$count` 统计、CTE 与窗口函数（当前 `service-personnel` 已落地，可继续抽象）
  - 使用 `sql``mapWith`` 实现类型安全的聚合结果映射，防止 bigint -> string 带来精度问题

- **配置与安全**
  - 所有外部凭证（Aliyun、Alipay、Tencent）置于 `.env`，并通过 Nest `ConfigModule` 注入
  - 建议引入配置验证（`@nestjs/config` + `zod`）确保部署环境完整

## 6. 优先级建议（近期 2-3 周）

1. **立即修复**
   - 修改 `user-auth-real-name.controller.ts` 中 `@Param('id')` -> `@Param('userId')`
   - 将阿里云、支付宝配置迁移至环境变量，并在 README/ENV 模板中列明

2. **师傅端必备接口补齐**
   - 订单：新增师傅维度查询、状态流转（接受/拒绝/取消）、批量拉取任务
   - 通知：设计 `notification` 模块（事件消费、消息发送、已读状态）
   - 账号绑定：抽象 `pay-binding` 子模块，接入支付宝授权码与后续微信预留接口

3. **体验与观测**
   - 收支明细开放查询 API + 分页、聚合统计
   - 核验/支付/提现流程补充审计日志与告警阈值
   - `service-personnel` 检索加入缓存（GeoHash + Redis）与慢查询监控

## 7. 建议的交付节奏

- **第 1 周**：安全整改 + 实名/支付硬编码清理 + 订单师傅端接口设计评审
- **第 2 周**：实现订单接口、账号绑定、通知服务 MVP；联调扫码流程
- **第 3 周**：完成提现流程串联、收支明细开放、观测告警接入

## 8 已完成内容

- 修改 `user-auth-real-name.controller.ts` 中 `@Param('id')` -> `@Param('userId')`
- 将阿里云、支付宝配置迁移至环境变量，并在 README/ENV 模板中列明
- 完善 `AuthGuard` 类型定义，修正未登录判断逻辑，补充无权限访问异常抛出
- 师傅端实名认证页面接入 `GET /userAuthRealName/realNameAuth` + `POST /userAuthRealName`，校验结果写回 `user_profiles` 并触发个人中心的 `user-real-name-profile` 缓存刷新
- 新增 `/pay/earnings/overview`、`/pay/earnings/transactions` 接口，移动端收益页同步展示实时余额、月度/累计收益与交易流水

## 9. 附录

- 业务需求来源：`work.md`
- 主要参考资料：
  1. Trilon, *NestJS & DrizzleORM: A Great Match*, 2025-02-20
  2. GitHub `sixaphone/nestjs-drizzle` README, 2025
  3. Mithle.sh, *How to use Drizzle ORM with NestJS*, 2023-12-20
  4. Dev.to, *How to integrate Drizzle ORM with Nest Js*, 2024-09-17
  5. Drizzle ORM 官方文档 `SQL Select`
