# Mobile User Merchant Settlement Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户端按摩首页新增“商户入驻”独立路由页面，并以 [pencil-new.pen](/mnt/f/home_server/pencil-new.pen) 的招募页画板为视觉基准，完成首页跳转、页面还原、`react-hook-form` 本地校验和成功提示。

**Architecture:** 保持 Expo Router 现有结构，在 `app/massage` 下新增薄路由文件，并把 UI 与表单逻辑集中到 `components/massage/merchant-settlement-screen.tsx`。实现过程中先依据设计稿拆出黄色头图、米白主卡、白色字段区和橙色 CTA 四个视觉层级，再把 `react-hook-form` 绑定到这些已按设计稿建好的 UI 上，避免先做通用表单再“补皮肤”。

**Tech Stack:** Expo Router 6、React Native、NativeWind、`react-hook-form`、`@repo/mobile-ui`、`sonner-native`

---

## File Map

- Create: `apps/mobile-user/app/massage/merchant-settlement.tsx`
  责任：Expo Router 页面入口，只导出 screen 组件。
- Create: `apps/mobile-user/components/massage/merchant-settlement-screen.tsx`
  责任：招募页 UI、字段定义、本地校验、提交成功提示。
- Modify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`
  责任：给“商户入驻”入口补路由跳转。
- Modify: `apps/mobile-user/app/_layout.tsx`
  责任：注册新 Stack 页面标题和返回行为。

## Visual Reference

- Reference: [pencil-new.pen](/mnt/f/home_server/pencil-new.pen)
- Target artboard: `Merchant Recruitment Screen`
- Visual baseline:
  - 顶部黄色横幅卡片，左侧两行大标题，右侧人物插画
  - 横幅下方米白主卡，承载整个表单
  - 主卡内部是白色圆角字段，而不是纯文本堆叠
  - 上传区保留红色提示文案和白底加号方块
  - 页面底部是宽尺寸高圆角橙色按钮

实现期间如果出现与设计稿不一致的地方，必须先解释偏差原因，再决定是否保留。

### Task 0: 先把设计稿作为执行约束固定下来

**Files:**
- Reference: `pencil-new.pen`
- Reference: `docs/superpowers/specs/2026-04-20-mobile-user-merchant-settlement-design.md`

- [ ] **Step 1: 打开 spec 和设计稿，确认本任务是“按设计稿还原页面”，不是“实现一个同类表单页”**

Expected:

- 能明确读到设计稿是唯一视觉基准
- 能明确读到黄色横幅、米白主卡、上传提示文案、橙色 CTA 是强约束

- [ ] **Step 2: 记录实现时必须对齐的视觉项**

需要显式对齐以下 5 项：

- 黄色头图卡片，左文右图，两行大标题
- 米白大圆角主卡包裹表单
- 白色圆角输入框与橙色性别选中态
- 上传区红色提示 + 白底加号方块
- 底部宽橙色圆角提交按钮

- [ ] **Step 3: 不满足以上 5 项时，不进入“页面已完成”状态**

Expected:

- 后续任务的代码和回归都必须显式检查这 5 项

### Task 1: 注册商户入驻路由

**Files:**
- Create: `apps/mobile-user/app/massage/merchant-settlement.tsx`
- Modify: `apps/mobile-user/app/_layout.tsx`

- [ ] **Step 1: 新增薄路由文件，只负责导出 `MerchantSettlementScreen`**

要求：

- 路由文件不要承载表单逻辑
- 文件职责保持和 `app/massage/index.tsx` 一致的轻量导出模式

- [ ] **Step 2: 在 `app/_layout.tsx` 注册新 Stack 页面**

要求：

- 路由名为 `massage/merchant-settlement`
- 标题为“商户入驻”
- 使用普通可返回的 header，不自定义复杂导航栏

- [ ] **Step 3: 运行类型检查，确认此时只暴露 screen 文件缺失问题**

Run: `pnpm --filter mobile-user run type-check`

Expected:

- 因为 `@/components/massage/merchant-settlement-screen` 尚未创建而报错
- `app/_layout.tsx` 不应出现额外语法错误

- [ ] **Step 4: 提交路由骨架**

Run: `git add apps/mobile-user/app/massage/merchant-settlement.tsx apps/mobile-user/app/_layout.tsx && git commit -m "feat(mobile-user): scaffold merchant settlement route"`

### Task 2: 实现商户入驻页面与本地校验

**Files:**
- Create: `apps/mobile-user/components/massage/merchant-settlement-screen.tsx`

- [ ] **Step 1: 创建 `merchant-settlement-screen.tsx`，先搭出页面骨架和表单类型**

要求：

- 定义表单字段类型：姓名、性别、手机号、年龄、意向合作城市、图片占位字段
- 使用 `useForm` 建立默认值
- 第一版骨架就必须体现设计稿层级：浅暖色页面背景、黄色头图卡片、米白主卡容器
- 不允许先做纯白背景加普通标题的临时页

Expected:

- 即使尚未接入完整字段，也已经能看出设计稿里的“黄色头图 + 米白主卡”层级

- [ ] **Step 2: 接入 `react-hook-form` 字段校验和本地提交处理**

要求：

- 姓名：去空格后必填，长度 2-20
- 性别：必选
- 手机号：大陆手机号格式
- 年龄：正整数，范围 18-65
- 意向合作城市：去空格后必填
- 提交成功只做本地成功提示，不发请求，不清空表单

- [ ] **Step 3: 补齐全部字段 UI，并让字段样式跟设计稿一致**

要求：

- 文本字段统一使用白色圆角输入框
- 性别用行内单选，不用下拉或其他替代表达
- 性别选中态要有橙色强调
- 手机号、年龄使用数字键盘
- 错误文案放在字段下方，不要改成全局 toast 报错

- [ ] **Step 4: 完成上传区、提示文案和底部 CTA，按视觉层级一次收口**

要求：

- 上传区保留“上传本人生活照”和“图片不得超过8M”两层文案
- 上传占位区是白底小方块加号，不接图片选择
- 提交按钮必须是宽尺寸、高圆角、橙色主按钮
- 不要直接使用默认 Button 外观替代设计稿 CTA

Expected:

- 页面实现完成后，能直接肉眼识别出与设计稿一致的上传提示区和底部 CTA

- [ ] **Step 5: 跑类型检查并修掉 screen 文件错误**

Run: `pnpm --filter mobile-user run type-check`

Expected:

- `merchant-settlement-screen.tsx` 无类型错误
- `useForm`、`Controller`、`toast`、`useSafeAreaInsets` 等引用均已解析

- [ ] **Step 6: 提交页面实现**

Run: `git add apps/mobile-user/components/massage/merchant-settlement-screen.tsx apps/mobile-user/app/massage/merchant-settlement.tsx apps/mobile-user/app/_layout.tsx && git commit -m "feat(mobile-user): add merchant settlement screen"`

### Task 3: 接入按摩首页入口跳转

**Files:**
- Modify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`

- [ ] **Step 1: 给“商户入驻”入口补路由跳转**

要求：

- 只改“商户入驻”这一项
- 不要影响“收藏商户”现有行为
- 使用 Expo Router 现有路由写法，避免引入额外路由常量复杂度

- [ ] **Step 2: 运行类型检查确认 `Href`/路由字符串没有新错误**

Run: `pnpm --filter mobile-user run type-check`

Expected:

- `massage-landing-screen.tsx` 无类型错误
- 新路由字符串与 Expo Router 生成类型兼容

- [ ] **Step 3: 提交首页跳转**

Run: `git add apps/mobile-user/components/massage/massage-landing-screen.tsx && git commit -m "feat(mobile-user): wire merchant settlement entry"`

### Task 4: 收尾验证与人工回归

**Files:**
- Verify: `apps/mobile-user/app/_layout.tsx`
- Verify: `apps/mobile-user/app/massage/merchant-settlement.tsx`
- Verify: `apps/mobile-user/components/massage/merchant-settlement-screen.tsx`
- Verify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`

- [ ] **Step 1: 运行 lint**

Run: `pnpm --filter mobile-user run lint`

Expected:

- 新增页面和修改文件通过 lint
- 没有未使用变量、未导入组件、格式错误

- [ ] **Step 2: 再跑一次类型检查作为总验收**

Run: `pnpm --filter mobile-user run type-check`

Expected:

- `mobile-user` 整体通过 TypeScript 检查

- [ ] **Step 3: 执行手工回归**

Run: `pnpm mobile-user:dev`

Expected:

- 进入按摩首页后，点击“商户入驻”可进入新页面
- 导航栏标题显示“商户入驻”，返回行为正常
- 姓名、性别、手机号、年龄、意向合作城市的错误提示符合规格
- 上传区域仅为静态占位，不触发崩溃或假上传
- 提交合法表单时出现成功提示，不发起网络请求
- 对照设计稿检查时，黄色头图、米白主卡、白色字段区、红色上传提示、橙色按钮五项均存在
- 页面不能看起来像“功能对了但换了套 UI”的通用表单页

- [ ] **Step 4: 提交最终整合改动**

Run: `git add apps/mobile-user/app/_layout.tsx apps/mobile-user/app/massage/merchant-settlement.tsx apps/mobile-user/components/massage/merchant-settlement-screen.tsx apps/mobile-user/components/massage/massage-landing-screen.tsx && git commit -m "feat(mobile-user): add merchant settlement flow"`
