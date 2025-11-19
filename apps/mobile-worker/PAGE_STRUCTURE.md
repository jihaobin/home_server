# 服务人员端（Worker App）页面结构说明

## 概述

本文档描述了服务人员端移动应用的完整页面结构和功能实现。所有页面均已使用 React Native + Expo Router 实现，采用 TypeScript 和 NativeWind 样式。

## 页面导航架构

### 主标签页 (Tab Navigation)

位于 `app/(tabs)/` 目录：

#### 1. 首页 (`index.tsx`) ✅

- **功能**：订单概览和快捷操作
- **主要组件**：
  - 统计数据卡片（今日订单、本月收益、完成订单、评分）
  - 快捷操作按钮（扫码接单、个人信息、服务设置、立即提现）
  - 待处理订单列表
- **路由跳转**：
  - `/scan` - 扫码页面
  - `/profile/edit` - 个人信息编辑
  - `/profile/service-settings` - 服务设置
  - `/earnings/withdraw` - 提现页面
  - `/orders/[id]` - 订单详情

#### 2. 订单页 (`orders.tsx`) ✅

- **功能**：订单列表和管理
- **主要功能**：
  - Tab 筛选（全部、待接单、进行中、已完成、已取消）
  - 订单状态展示（颜色标识）
  - 订单操作（接单、拒绝、完成服务）
- **数据展示**：
  - 服务名称、客户信息
  - 服务地址、预约时间
  - 服务价格、订单状态

#### 3. 收益页 (`earnings.tsx`) ✅

- **功能**：财务明细和提现
- **主要组件**：
  - 账户余额卡片
  - 收益统计（本月收益、累计收益）
  - 交易记录列表（收入/提现）
  - Tab 筛选（全部、收入、提现）
- **路由跳转**：
  - `/earnings/withdraw` - 提现页面

#### 4. 个人中心 (`profile.tsx`) ✅

- **功能**：个人信息和设置
- **主要组件**：
  - 用户信息卡片（头像、姓名、认证状态、工作年限）
  - 统计数据（服务次数、评分、总收益）
  - 菜单列表（个人信息、服务设置、服务区域、实名认证、账号绑定、设置）
  - 退出登录按钮

---

### 堆栈导航页面 (Stack Navigation)

#### 实名认证模块

##### `/verification/id-card.tsx` ✅

- **功能**：身份证实名认证
- **表单字段**：
  - 真实姓名
  - 身份证号（18位验证）
- **特色功能**：
  - 身份证格式验证
  - 安全提示（加密传输、严格保密）
  - 认证状态反馈
- **接口联调**：调用 `GET /userAuthRealName/realNameAuth` 进行三要素校验，通过后请求 `POST /userAuthRealName` 写入实名信息

---

#### 个人信息管理模块

##### `/profile/edit.tsx` ✅

- **功能**：编辑个人资料
- **可编辑字段**：
  - 头像（图片上传）
  - 姓名
  - 手机号
  - 工作年限

##### `/profile/service-settings.tsx` ✅

- **功能**：服务设置和管理
- **核心功能**：
  - 选择提供的服务类型（多选）
  - 为每个服务添加多个规格
  - 设置每个规格的：
    - 规格名称
    - 价格
    - 预计时长
    - 服务描述和注意事项
- **交互特色**：
  - 可展开/折叠的服务卡片
  - 动态添加/删除服务规格
  - 实时保存功能

##### `/profile/service-area.tsx` ✅

- **功能**：服务区域设置
- **主要功能**：
  - 多选服务区域（区县级）
  - 显示子区域（街道/商圈）
  - 已选区域标签展示
- **数据展示**：
  - 区域距离提示
  - 子区域列表

##### `/profile/account-binding.tsx` ✅

- **功能**：绑定支付账号
- **支持平台**：
  - 支付宝（账号 + 真实姓名）
  - 微信（账号 + 真实姓名）
- **核心功能**：
  - 账号绑定/解绑
  - 多账号管理
  - 安全提示

##### `/profile/settings.tsx` ✅

- **功能**：应用设置
- **设置项**：
  - 通知设置（推送、声音、震动）
  - 账号安全（修改密码、安全设置）
  - 其他（清除缓存、隐私政策、服务条款、关于我们）

---

#### 订单管理模块

##### `/orders/[id].tsx` ✅

- **功能**：订单详情页
- **信息展示**：
  - 订单状态（大图标显示）
  - 服务信息（项目、规格、费用、时长、时间）
  - 客户信息（姓名、电话、一键拨打）
  - 服务地址（详细地址、距离、导航按钮）
  - 备注信息
- **操作功能**：
  - 待接单状态：接单 / 拒绝
  - 进行中状态：扫码验证 / 完成服务
  - 一键拨打客户电话
  - 导航到服务地址

---

#### 扫码验证模块

##### `/scan/index.tsx` ✅

- **功能**：二维码扫描
- **技术实现**：
  - Expo Camera 集成
  - 相机权限管理
  - 前后摄像头切换
- **UI 特色**：
  - 扫描框四角标识
  - 操作提示文字
  - 关闭和切换按钮

---

#### 财务管理模块

##### `/earnings/withdraw.tsx` ✅

- **功能**：提现申请
- **主要组件**：
  - 可提现余额显示
  - 提现金额输入（带快捷选择）
  - 提现账户选择（支付宝/微信）
  - 提现说明（到账时间、金额限制）
- **业务逻辑**：
  - 最低/最高提现金额验证
  - 余额充足性检查
  - 账户绑定状态验证

---

## 页面路由关系图

```
app/
├── (tabs)/                      # Tab 导航（底部标签栏）
│   ├── index.tsx               # 首页
│   ├── orders.tsx              # 订单列表
│   ├── earnings.tsx            # 收益页
│   └── profile.tsx             # 个人中心
│
├── verification/               # 实名认证模块
│   └── id-card.tsx            # 身份证认证
│
├── profile/                    # 个人信息模块
│   ├── edit.tsx               # 编辑资料
│   ├── service-settings.tsx   # 服务设置
│   ├── service-area.tsx       # 服务区域
│   ├── account-binding.tsx    # 账号绑定
│   └── settings.tsx           # 应用设置
│
├── orders/                     # 订单模块
│   └── [id].tsx               # 订单详情（动态路由）
│
├── scan/                       # 扫码模块
│   ├── index.tsx              # 扫码页面
│   └── explore.tsx            # 扫码结果（地图）
│
└── earnings/                   # 财务模块
    └── withdraw.tsx           # 提现页面
```

---

## 数据模型（模拟）

### 用户信息

```typescript
{
  name: string;           // 姓名
  phone: string;          // 手机号
  workYears: number;      // 工作年限
  avatar: string;         // 头像URL
  isVerified: boolean;    // 是否实名认证
  rating: number;         // 评分
  serviceCount: number;   // 服务次数
  totalEarnings: number;  // 总收益
}
```

### 订单信息

```typescript
{
  id: string;
  serviceName: string;          // 服务名称
  serviceSpec: string;          // 服务规格
  status: OrderStatus;          // pending | ongoing | completed | cancelled
  price: number;                // 价格
  duration: number;             // 时长（小时）
  orderTime: string;            // 下单时间
  serviceTime: string;          // 服务时间
  customer: {
    name: string;
    phone: string;
  };
  address: {
    detail: string;
    distance: string;
    lat: number;
    lng: number;
  };
  description?: string;         // 备注
}
```

### 交易记录

```typescript
{
  id: string;
  type: 'income' | 'withdrawal'; // 收入 | 提现
  amount: number;                 // 金额
  time: string;                   // 时间
  description: string;            // 描述
  status?: 'pending' | 'completed' | 'failed'; // 状态（仅提现）
}
```

---

## 设计特点

### 1. 视觉设计

- **颜色体系**：
  - 主色：`#2196F3`（蓝色）- 常规操作
  - 成功色：`#4CAF50`（绿色）- 确认、接单
  - 警告色：`#FF9800`（橙色）- 待处理
  - 错误色：`#FF5722`（红色）- 价格、拒绝
- **圆角设计**：12px 统一圆角，提升现代感
- **阴影效果**：统一的卡片阴影（elevation: 3）
- **图标系统**：使用 Ionicons 图标库

### 2. 交互设计

- **快捷操作**：首页提供快捷入口，减少操作层级
- **状态反馈**：清晰的订单状态标识和颜色区分
- **表单验证**：实时验证和错误提示
- **确认弹窗**：重要操作（接单、拒绝、提现）需要二次确认

### 3. 用户体验

- **信息层级**：重要信息突出显示（余额、价格、状态）
- **操作便捷**：一键拨打、快捷金额选择
- **数据展示**：统计数据可视化，清晰直观
- **空状态**：友好的空列表提示

---

## 技术实现

### 核心技术栈

- **框架**：React Native (Expo SDK 54)
- **路由**：Expo Router 6.x（文件系统路由）
- **语言**：TypeScript 5.x
- **样式**：NativeWind 4.x（Tailwind CSS for RN）
- **图标**：@expo/vector-icons

### 已集成的功能模块

- ✅ 相机扫码（expo-camera）
- ✅ 权限管理（Camera Permissions）
- ✅ 电话拨打（Linking API）
- ⏳ 地图导航（待集成）
- ⏳ 推送通知（待集成）
- ⏳ 图片上传（待集成）

### 待集成的 API

- [x] 实名认证 API
- [ ] 用户信息 CRUD
- [ ] 订单查询和操作
- [ ] 财务记录查询
- [ ] 提现申请
- [ ] 账号绑定

---

## 下一步开发计划

1. **API 集成**
   - 连接后端 API
   - 实现数据持久化
   - 添加状态管理（Zustand）

2. **功能增强**
   - 推送通知集成
   - 地图导航功能
   - 图片上传功能
   - 位置验证

3. **性能优化**
   - 列表虚拟化（FlashList）
   - 图片懒加载
   - 缓存策略

4. **测试**
   - 单元测试
   - 集成测试
   - E2E 测试

---

## 页面截图说明

各页面的视觉效果和交互细节请参考实际运行效果。所有页面均已实现响应式设计，适配不同屏幕尺寸。

---

最后更新时间：2025-11-11
