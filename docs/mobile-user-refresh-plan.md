# 用户端页面下拉刷新改造清单

根据 `apps/mobile-user/app` 目录下现有的 Expo Router 页面，梳理出所有需要补充下拉刷新的用户端界面：

## 页面统计

| 序号 | 页面/功能 | Expo Router 路径 | 组件文件 | 主要数据来源 | 刷新场景关注点 |
| --- | --- | --- | --- | --- | --- |
| 1 | 首页 - 服务发现 | /(tabs)/index | apps/mobile-user/app/(tabs)/index.tsx | `useServiceList`、`useServicePersonnelSearch`、`useLocation`、`useServiceStore` | 重新触发服务分类/子服务分页请求、刷新定位信息并重新拉服务人员列表 |
| 2 | 订单中心列表 | /(tabs)/orders | apps/mobile-user/app/(tabs)/orders/index.tsx | `useOrdersListInfinite`、`useSession` | 重置无限滚动游标，按当前 Tab 筛选条件重新请求订单页数据 |
| 3 | 个人中心 | /(tabs)/profile | apps/mobile-user/app/(tabs)/profile.tsx | `useUserRealNameProfile`、`useOrdersList`、`useSession` | 现有 RefreshControl 仅负责档案数据，需要补充触发订单统计等 Suspense 查询的 refetch |
| 4 | 订单详情 | /order/[id] | apps/mobile-user/app/order/[id].tsx | `useOrderDetail`、`useOrderCheckin`、`useOrderActions` | 下拉时重新拉取订单详情与核验二维码，确保操作按钮状态同步 |
| 5 | 服务人员详情 | /servicePersonnel | apps/mobile-user/app/servicePersonnel/index.tsx | `useServicePersonnelDetails`、`useServiceStore` | 刷新规格列表、可预约时间及工作日信息，必要时重置 store 中的选择 |
| 6 | 服务时间选择 | /servicePersonnel/time-picker | apps/mobile-user/app/servicePersonnel/time-picker.tsx | `useServiceStore`、路由参数 | 重新生成日历与时间段，后续对接远端工作日配置时也可通过刷新强制拉取 |
| 7 | 订单确认 | /servicePersonnel/order-confirm | apps/mobile-user/app/servicePersonnel/order-confirm.tsx | `useServiceStore`、`useAddressEditStore`、`useSession` | 重新同步服务规格、预约时间与地址信息，防止使用陈旧的 zustand 数据 |
| 8 | 支付结果 | /servicePersonnel/payment-result | apps/mobile-user/app/servicePersonnel/payment-result.tsx | 路由参数（`orderId`、`success` 等） | 下拉时以 `orderId` 调用订单详情确认最终状态，必要时引导跳转订单页 |
| 9 | 服务地址管理 | /address/service-address | apps/mobile-user/app/address/service-address.tsx | `useUserAddresses`、`useDeleteAddress` | 重新获取地址列表并清理可能残留的选中项，删除后也可手动刷新确认 |
| 10 | 城市选择 | /address/select-city | apps/mobile-user/app/address/select-city.tsx | `useChinaCity`、`useCitySearchSuspense`、`useCityParentInfo` | 重新拉取城市列表/热门城市，并刷新搜索建议内容 |
| 11 | 详细地址选择 | /address/select-address | apps/mobile-user/app/address/select-address.tsx | `useAddressSuggestionInfiniteSuspense`、`useLocationDetail`、`useUserAddresses`、`useLocation` | 下拉时刷新定位、附近 POI 与搜索建议分页结果 |
| 12 | 编辑/新增地址 | /address/edit-address | apps/mobile-user/app/address/edit-address.tsx | `UseCreateAddress`、`useLocation`、`useAddressEditStore`、`useSession` | 重新读取定位及 store 中的地址草稿，刷新默认值（含定位权限异常情况） |
| 13 | 登录 | /auth/login | apps/mobile-user/app/auth/login.tsx | `authClient`、`useSession` | 提供下拉刷新以重置表单/清理错误并触发 `SessionProvider` 的 `refetch` |
| 14 | 注册 | /auth/register | apps/mobile-user/app/auth/register.tsx | `authClient` | 下拉重置表单状态、验证码倒计时，并确保后续 OTP 请求使用最新输入 |
| 15 | 忘记密码 | /auth/forgot-password | apps/mobile-user/app/auth/forgot-password.tsx | `authClient` | 同步刷新验证码倒计时/错误提示，便于用户重新获取验证码 |
