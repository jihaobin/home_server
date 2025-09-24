# Types Agents 指南

## 快速概览

- `@repo/types` 提供跨应用共享的 TypeScript 类型与 Zod Schema 支撑后端与多端客户端。
- 源码集中在 `src/`，`dist/` 由 tsup 自动生成，聚合入口为 `src/index.ts`。
- 统一使用 TypeScript 5.8 与 `zod/v4`；消费侧覆盖 NestJS、React、Expo 等多种运行时。
- 文件命名按业务域划分（address、service、order 等），便于与后端模块一一对应。

## 目录速查

- `src/common.ts`：通用 API 响应、分页类型及对应用于文档的 Zod Schema。
- `src/address.ts`：地址、城市、行政区划相关类型定义。
- `src/service.ts` / `src/work-skill.ts`：服务项目与技能标签领域模型。
- `src/order.ts`：订单、支付状态、结算相关枚举与接口。
- `src/userAuthRealName.ts`：实名认证流程、材料校验所需结构。
- `src/database-entity.ts`：数据库实体公共字段与 ID 约定。
- `dist/`：构建产物目录，禁止手动编辑或提交更改。

## 开发流程

- 安装依赖：在仓库根目录执行 `pnpm install` 初始化 workspace。
- 本地调试：使用 `pnpm --filter @repo/types dev` 监听构建，单次输出用 `pnpm --filter @repo/types build`。
- 校验命令：`pnpm --filter @repo/types lint`、`pnpm --filter @repo/types type-check`，提交前需全部通过。
- 构建结果同时生成 ESM、CJS 与 `.d.ts`，仅会输出在 `src/index.ts` 中显式导出的符号。

## 类型约定

- 所有类型、枚举与 Schema 必须使用命名导出，并在 `src/index.ts` 汇总；保持导出顺序稳定以减少 diff。
- 与后端 Drizzle Schema 对齐的字段保持 `snake_case`，前端所需的驼峰转换交由消费端处理。
- 统一依赖 `zod/v4`，新增 Schema 需补充 `.meta()` 描述（`title`/`description`/`examples`）以便自动生成文档。
- 若类型间存在互相引用，优先拆分基础类型与复合类型，避免循环依赖；必要时使用 `type` 交叉类型组合。
- 变更涉及现有业务时需同步检查 `apps/backend`、`apps/admin-web`、`apps/mobile-user`、`apps/mobile-worker` 的使用点并更新。

## 发布与版本管理

- `package.json` 标记为 `private: true`，通过 pnpm workspace 分发，不单独发布 npm。
- 严禁手动修改或提交 `dist/` 内文件，CI 会通过 tsup 自动产出。
- 涉及 Breaking 变更请在 PR 标题与描述中明确说明，并附带迁移或兼容性指导。

## 常见注意事项

- 新增领域时创建独立的 `src/<domain>.ts` 文件，同时在 `src/index.ts` 导出以保持入口整洁。
- 类型需与实际业务实现保持同步，必要时为变更附加示例或断言测试以防止回归。
- 引入新依赖（例如额外的 Zod 插件）前确认对 tree-shaking 与打包体积的影响，并在 `package.json` 中声明。
- 修改完成后建议运行仓库根目录的 `pnpm build` 验证 Turbo 构建图无异常，再开展后续工作。
