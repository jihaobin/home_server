# 服务人员资质证书结构化展示与按摩服务证书校验设计稿

> 目标：让用户端 [qualification-certificates.tsx](/mnt/f/home_server/apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx) 不再依赖文件名猜图，改为消费后端结构化的身份证脱敏信息、商家资质和从业资格证书；同时在服务人员端 [service-settings.tsx](/mnt/f/home_server/apps/mobile-worker/app/profile/service-settings.tsx) 中补齐证书上传入口，并仅在“上门按摩”分类服务被配置时强制要求至少上传一种证书。

## 1. 背景与问题

当前资质证书链路存在三个明确缺口：

- 用户端资质页目前只消费 `qualificationImages`，并通过文件名关键词猜测“商家资质”与“从业资格证书”，不存在结构化字段
- 用户端身份证号不是接口返回的真实展示值，而是写死占位文案
- 服务人员端 `service-settings.tsx` 目前只能配置服务描述、宣传图与规格，缺少商家资质 / 从业资格证书上传入口

同时，现有业务规则已经明确：

- 该页面展示的是服务人员在服务人员端配置的商家资质、从业资格证书和身份证脱敏信息
- 身份证号必须做隐私处理后展示
- 只有在服务人员配置“上门按摩”分类服务时，才要求商家资质和从业资格证书至少上传一种
- 其他服务分类暂时不受该证书规则约束

本次设计的核心目标不是“临时把页面接上数据”，而是把这条链路改成可持续维护的结构化模型，避免继续依赖文件名约定。

## 2. 设计结论

- 在 `service_personnel` 表中新增两个结构化字段，分别保存商家资质和从业资格证书文件 ID
- 不再把 `qualificationImages` 作为真实数据来源，用户端资质页直接读取结构化证书字段
- 服务人员端不新增独立证书页，继续使用 [service-settings.tsx](/mnt/f/home_server/apps/mobile-worker/app/profile/service-settings.tsx) 作为唯一编辑入口
- 证书保存继续走现有 `PUT /workSkill/offerings` 链路，只是扩展顶层请求字段
- 只有当本次保存的服务列表中包含“上门按摩”分类服务时，才强制要求两个证书字段至少存在一个
- 服务端必须做同样的兜底校验，不能只依赖前端拦截
- 用户端身份证脱敏复用现有实名认证接口已使用的掩码策略，保持 `3 + * + 4` 规则一致，不单独实现新的 `4 + 4` 规则
- 为兼容现有 worker 端个人中心“资质证明”区块，`qualificationImages` 字段暂时保留，但改由新的结构化证书字段回填生成

## 3. 现状调研结论

### 3.1 已存在的能力

- [service-settings.tsx](/mnt/f/home_server/apps/mobile-worker/app/profile/service-settings.tsx) 已具备服务选择、宣传图上传、规格编辑与保存能力
- `useUpdateServiceOfferings()` 已封装 `PUT /workSkill/offerings`
- `useUploadFile()`、`/files/upload`、`/files/:id` 已能完成文件上传和预签名 URL 获取
- `ServicePersonnelService.getPersonnelProfile(...)` 已是用户端资质页的聚合资料来源
- `user_profiles.id_card_number` 已存在，并且实名认证控制器里已有统一的身份证掩码实现

### 3.2 当前限制

- `service-settings.tsx` 当前只在本地状态中保留 `categoryName`，没有稳定的 `categoryId`
- `ServicePersonnelProfile` 目前没有 `maskedIdCardNumber`、`merchantQualificationImage`、`vocationalQualificationImage`
- `qualificationImages` 在现有代码里没有稳定写入来源，且仓库中没有基于该字段的结构化保存逻辑
- 当前仓库没有独立的“资质证书编辑页”，也没有面向证书的专用保存接口

### 3.3 必须避免的误区

- 不要继续依赖文件名或 URL 关键词来判断证书类型
- 不要把证书必填校验放到 `workInfo` 等通用资料接口中，以免误伤其他页面保存
- 不要把证书字段挂到单个服务规格下，证书属于服务人员级资料，不属于某个 `serviceId`
- 不要在前端保存时写死中文分类名来判断“上门按摩”，必须使用稳定分类 ID

## 4. 方案比较

### 方案 A：扩展现有 `updateServiceOfferings` 链路，同时新增结构化证书字段

做法：

- 在 `service_personnel` 新增两个证书文件 ID 字段
- 扩展 `UpdateServiceOfferingsRequest`
- 在 `service-settings.tsx` 中新增证书上传区
- 在 `ServicePersonnelProfile` 中补充结构化证书字段和身份证脱敏字段

优点：

- 服务选择与证书校验在同一次保存中完成，业务闭环最清晰
- 不新增额外路由或接口，改动集中
- “仅按摩分类要求证书”这条规则天然绑定在服务设置提交流程中

缺点：

- 需要同时修改前端状态、共享类型、后端校验和 profile 聚合返回

结论：

- 本期采用

### 方案 B：新增独立证书保存接口

优点：

- 接口职责更纯粹

缺点：

- 证书校验和服务配置被拆成两条链路
- 页面需要协调两次保存，易出现状态不一致
- 用户体验会退化成“选了按摩服务但证书还得去别处补”

结论：

- 本期不采用

### 方案 C：继续沿用 `qualificationImages`，只在展示层增强关键词匹配

优点：

- 表面改动更少

缺点：

- 仍然依赖文件名约定
- 没有稳定的读写契约
- 后续维护成本高，且无法支撑服务端硬校验

结论：

- 本期不采用

## 5. 数据模型与共享常量设计

### 5.1 按摩分类常量

为了避免前后端各写一份魔法值，本期补充共享常量：

- `packages/types/src/massage.ts`
  - `export const MASSAGE_CATEGORY_ID = "wgla64hwo7zr9iz"`

使用原则：

- `mobile-user`、`mobile-worker`、`backend` 都从共享层引用该常量
- 不再在页面文件或 service 中直接硬编码 `wgla64hwo7zr9iz`

### 5.2 数据库字段

在 `service_personnel` 表新增：

- `merchant_qualification_file_id`
- `vocational_qualification_file_id`

字段要求：

- 类型：`varchar(255)`
- 允许为 `null`
- 表达的是文件主标识，不直接存 URL

职责边界：

- 这两个字段属于服务人员级资料
- 它们不应跟单个服务、单个规格、单个分类形成一对一绑定

### 5.3 聚合资料协议

在 `ServicePersonnelProfile` 中新增：

- `maskedIdCardNumber: string | null`
- `merchantQualificationImage: FileAccessInfo | null`
- `vocationalQualificationImage: FileAccessInfo | null`

兼容字段：

- `qualificationImages` 先保留
- 该字段不再单独读库，而是由 `merchantQualificationImage`、`vocationalQualificationImage` 按顺序拼成数组回填

### 5.4 服务配置协议

在 `UpdateServiceOfferingsRequest` 顶层新增：

- `merchantQualificationFileId?: string | null`
- `vocationalQualificationFileId?: string | null`

说明：

- 证书字段放在请求顶层，而不是 `services[]` 内部
- 这样可以明确表达“这是人员级配置，不是某个服务项的专属字段”

### 5.5 服务列表回显协议

在 `ServicePersonnelOffering` 中补充：

- `categoryId?: string | null`
- `categoryName?: string | null`

目的：

- 让 `service-settings.tsx` 在重新进入页面时，能根据已保存的服务列表稳定判断是否已包含上门按摩分类
- 避免页面只能依赖临时的 `categoryName` 文案做业务判断

## 6. 接口与后端行为设计

### 6.1 `PUT /workSkill/offerings`

该接口继续作为服务设置的唯一保存接口，不新增新路由。

请求体新增顶层字段后，结构变为：

```ts
type UpdateServiceOfferingsRequest = {
    services: Array<{
        serviceId: string;
        description?: string | null;
        galleryFileIds?: string[];
        specifications: Array<{
            id?: string;
            name?: string;
            price: string;
            currency: string;
            estimatedDurationMinutes: number;
        }>;
    }>;
    merchantQualificationFileId?: string | null;
    vocationalQualificationFileId?: string | null;
};
```

接口职责：

- 继续负责服务分类、宣传图、规格保存
- 同时保存两个证书字段
- 在命中按摩分类时承担服务端业务校验

### 6.2 服务端校验规则

校验位置：

- `WorkSkillService.updateServiceOfferings(...)`

校验策略：

- 根据本次提交的 `serviceIds` 查询对应服务的 `categoryId`
- 只要其中任意服务命中 `MASSAGE_CATEGORY_ID`
- 就要求 `merchantQualificationFileId` 与 `vocationalQualificationFileId` 至少有一个非空
- 否则抛出 `BadRequestException`

明确不做的事：

- 不在 `workInfo` 接口中复用该规则
- 不要求两种证书都上传
- 不对非按摩分类服务触发该规则

### 6.3 服务人员聚合资料接口

`GET /service-personnel/profile/:personnelId` 继续作为用户端资质页的数据来源。

新增聚合内容：

- 读取 `user_profiles.id_card_number`
- 使用现有实名认证接口一致的 `3 + * + 4` 掩码规则生成 `maskedIdCardNumber`
- 读取 `merchant_qualification_file_id`
- 读取 `vocational_qualification_file_id`
- 调用 `FilesService.getFileAccessInfo(...)` 转成 `FileAccessInfo`

返回要求：

- 文件不存在时，对应字段返回 `null`
- 身份证不存在时，`maskedIdCardNumber` 返回 `null`
- 兼容字段 `qualificationImages` 由两个结构化证书字段拼接而成，不再依赖旧的弱结构化来源

## 7. 服务人员端页面设计

目标页面：

- [service-settings.tsx](/mnt/f/home_server/apps/mobile-worker/app/profile/service-settings.tsx)

### 7.1 状态结构

页面本地状态扩展为：

- `selectedServices[*].categoryId`
- `selectedServices[*].categoryName`
- `merchantQualification`
- `vocationalQualification`

其中证书状态至少需要保存：

- 文件 ID
- 可预览 URL

页面从 `profile` 回填时：

- 已选服务列表带上 `categoryId/categoryName`
- 已保存证书回填到两个上传位

### 7.2 证书区块展示规则

证书上传区块只在“当前已选服务中包含上门按摩分类”时显示。

区块内容：

- `商家资质`
- `从业资格证书`

每个上传位均支持：

- 选择并上传图片
- 预览已上传图片
- 删除已上传图片
- 替换已上传图片

上传能力：

- 继续复用 `useUploadFile()`
- 上传成功后继续通过现有 `fetchFileUrl()` 获取可访问 URL

### 7.3 页面校验规则

页面保存时的校验顺序：

- 先保留现有“至少选择一个服务分类、规格合法、宣传图不超过 5 张”等规则
- 再判断当前 `selectedServices` 是否包含 `MASSAGE_CATEGORY_ID`
- 若命中按摩分类，则要求两个证书字段至少一个有值
- 若未命中按摩分类，则不要求上传证书

交互要求：

- 校验失败时阻止提交
- 使用现有 `Alert.alert("提示", "...")` 风格返回错误

提示文案建议：

- `上门按摩服务需至少上传一种资质证书`

### 7.4 清空与保留策略

- 用户移除最后一个按摩服务后，本次保存不自动清空已上传证书
- 页面只是“不再强制要求”这些证书
- 如果用户手动删除证书，再保存也允许通过，因为此时已不再命中按摩分类

原因：

- 证书是服务人员级资料，可能会在后续重新启用按摩服务时继续复用
- 自动清空会增加重复上传成本

## 8. 用户端资质页展示设计

目标页面：

- [qualification-certificates.tsx](/mnt/f/home_server/apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx)

### 8.1 身份信息展示

身份证展示逻辑改为直接读取：

- `profile.maskedIdCardNumber`

展示原则：

- 不再写死占位文案
- 若为空，则展示“身份证信息暂未完善”之类的空态文案，而不是伪造号码

### 8.2 证书展示

证书卡片固定为两张：

- `所属商家资质`
- `从业资格证书`

数据来源分别为：

- `profile.merchantQualificationImage`
- `profile.vocationalQualificationImage`

展示原则：

- 不再做关键词猜图
- 某一类证书为空时，仅该卡片显示“暂无图片”
- 不因为另一张证书存在而隐藏空卡片

### 8.3 兼容行为

页面内部不再依赖 `qualificationImages` 做展示决策。

保留该字段的目的仅为：

- 兼容现有 worker 端个人中心中“资质证明”横向图集
- 给还未迁移完的旧代码提供过渡数据

## 9. 实现边界与兼容策略

### 9.1 本期要做

- 数据库新增两个证书字段
- 共享常量 `MASSAGE_CATEGORY_ID`
- 扩展 `UpdateServiceOfferingsRequest`
- 扩展 `ServicePersonnelProfile`
- `service-settings.tsx` 新增证书上传、回显和前端校验
- `WorkSkillService.updateServiceOfferings(...)` 新增服务端校验
- `qualification-certificates.tsx` 改读结构化字段

### 9.2 本期不做

- 新增独立证书管理页面
- 新增单独证书保存接口
- 为所有分类引入统一证书配置体系
- 改造 worker 端个人中心“资质证明”区块的视觉结构
- 对历史弱结构化 `qualificationImages` 做额外迁移脚本

### 9.3 兼容约束

- 旧的 `qualificationImages` 字段不立刻删除
- 旧前端如果仍在消费该字段，仍应拿到由两张结构化证书拼接出的数组
- 新逻辑必须保证未选择按摩服务的用户不受影响

## 10. 测试与验证策略

### 10.1 后端自动化

新增 `work-skill.service.spec.ts`，至少覆盖：

- 命中按摩分类且两个证书都为空时，保存被拒绝
- 命中按摩分类且商家资质存在时，保存通过
- 命中按摩分类且从业资格证书存在时，保存通过
- 未命中按摩分类时，即使两个证书都为空也可保存

### 10.2 前端验证

本仓库当前没有 `mobile-worker` 现成页面级自动化测试基建，因此本期以前端类型检查和手工回归为主：

- `pnpm --filter mobile-worker type-check`
- `pnpm --filter backend test -- --runInBand src/modules/work-skill/work-skill.service.spec.ts`

### 10.3 手工回归清单

- 在服务人员端只选择普通分类服务时，不上传证书也可保存
- 在服务人员端加入上门按摩服务时，不上传证书会被拦截
- 在服务人员端加入上门按摩服务时，只上传商家资质即可保存
- 在服务人员端加入上门按摩服务时，只上传从业资格证书即可保存
- 重新进入 `service-settings.tsx` 后，已上传证书可回显
- 用户端资质页可展示真实脱敏身份证号
- 用户端资质页可分别展示两类证书，不再依赖文件名猜图

## 11. 风险与注意事项

- 若只在前端判断按摩分类，而不在后端查询 `serviceId -> categoryId`，接口会存在绕过风险
- 若只在 `service-settings.tsx` 本地保留 `categoryName` 而不补 `categoryId`，重新进入页面后无法稳定判断是否需要证书
- 若把证书字段放进 `ServicePersonnelSchema` 但未同步调整 `UpsertWorkInfoRequestSchema` 的 `omit` 逻辑，可能会意外泄露到不相关接口
- 若继续在资质页保留关键词匹配逻辑，会导致结构化字段引入后仍有双轨来源，增加维护复杂度

## 12. 总结

本次设计将资质证书链路从“文件名猜测 + 页面写死占位”收敛为“结构化字段 + 单一保存入口 + 服务端兜底校验”。

核心收敛点只有三个：

- 证书字段进入 `service_personnel`，成为真实主数据
- `service-settings.tsx` 成为服务分类与证书配置的统一入口
- `qualification-certificates.tsx` 改为直接展示后端返回的结构化证书与脱敏身份证信息

这样既能满足“仅按摩分类强制要求证书”的当前需求，也不会把规则错误扩散到其他服务分类或其他资料保存页面。
