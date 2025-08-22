# Changelog

## [0.1.0] - 2025-08-22

### ✨ 新功能

- 🎯 **连续定位功能** - 基于腾讯地图定位SDK v7.6.1实现高精度连续定位
- 📱 **完整的定位配置** - 支持定位间隔、请求级别、GPS设置等全面配置选项
- 🔒 **隐私合规支持** - 完全符合Android隐私政策要求，支持隐私协议设置
- 📊 **实时事件监听** - 支持定位成功、定位失败、状态更新三类事件监听
- 🏢 **丰富的地址信息** - 支持获取行政区划、POI、详细地址等信息
- ⚙️ **自动配置插件** - 内置Config Plugin自动配置Android权限和API Key
- 🔧 **完整的TypeScript支持** - 提供完整的类型定义和智能提示

### 📚 API功能

#### 核心方法
- `setUserAgreePrivacy(isAgree: boolean)` - 设置隐私协议同意
- `setDeviceID(deviceId: string)` - 设置设备唯一标识
- `startLocationUpdates(request?: LocationRequest)` - 开始连续定位
- `stopLocationUpdates()` - 停止定位
- `hasLocationPermission()` - 检查定位权限
- `requestLocationPermission()` - 请求定位权限
- `getApiKey()` - 获取配置的API Key

#### 事件监听
- `addLocationListener(listener)` - 监听定位成功事件
- `addLocationErrorListener(listener)` - 监听定位错误事件
- `addStatusUpdateListener(listener)` - 监听状态更新事件
- `removeAllLocationListeners()` - 移除所有监听器

#### 类型定义
- `LocationChangedEvent` - 定位成功事件类型
- `LocationErrorEvent` - 定位错误事件类型
- `LocationStatusEvent` - 状态更新事件类型
- `LocationRequest` - 定位请求配置类型

#### 常量
- `RequestLevel` - 请求级别常量（GEO, NAME, ADMIN_AREA, POI）
- `LocationMode` - 定位模式常量（高精度, 仅网络, 仅GPS）
- `ErrorCodes` - 错误码常量
- `StatusCodes` - 状态码常量

### 🛠️ 配置功能

#### Config Plugin
- ✅ 自动添加腾讯地图API Key到AndroidManifest.xml
- ✅ 自动添加所有必需的Android权限
- ✅ 自动配置前台服务支持后台定位
- ✅ 支持iOS配置（为未来iOS支持做准备）

#### 自动配置的权限
- 基础定位权限（精确、粗略、后台）
- 网络权限（网络访问、状态检测）
- WiFi权限（状态检测、状态变更）
- 系统权限（读取手机状态、外部存储、前台服务）

### 📱 平台支持

- ✅ **Android** - 完整支持，基于腾讯地图定位SDK v7.6.1
- 🔮 **iOS** - 预留接口，未来版本支持

### 🔧 技术实现

#### Android Native Module (Kotlin)
- 实现了完整的TencentLocationListener接口
- 支持所有主要定位配置参数
- 完善的错误处理和资源管理
- 事件发送机制支持实时通信

#### TypeScript接口
- 完整的类型定义和智能提示
- 便捷的函数封装
- 一致的API设计

#### Config Plugin (TypeScript)
- 基于Expo Config Plugins框架
- 自动化配置Android项目
- 支持自定义API Key配置

### 📖 文档

- 📚 完整的README.md - 包含API参考、配置指南、示例代码
- 📋 详细的USAGE_GUIDE.md - 包含最佳实践和常见问题
- 🔧 PLUGIN_GUIDE.md - Config Plugin使用指南
- 📝 完整的示例代码 - React Hook封装和组件使用示例

### 🚀 使用示例

```typescript
import {
  setUserAgreePrivacy,
  startLocationUpdates,
  addLocationListener,
  RequestLevel,
  LocationMode
} from 'expo-qq-location';

// 设置隐私协议同意
setUserAgreePrivacy(true);

// 添加监听器
const subscription = addLocationListener((event) => {
  console.log('位置:', event.latitude, event.longitude);
  console.log('地址:', event.address);
});

// 开始定位
await startLocationUpdates({
  interval: 5000,
  requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
  allowGPS: true,
  locMode: LocationMode.HIGH_ACCURACY_MODE
});
```

### 🔧 配置示例

```json
{
  "expo": {
    "plugins": [
      [
        "expo-qq-location",
        {
          "apiKey": "your_tencent_map_api_key"
        }
      ]
    ]
  }
}
```

---

## 下一步计划

- 🍎 iOS平台支持
- 🗺️ 单次定位功能
- 🎯 地理围栏功能
- 📍 逆地理编码优化
- 🔋 更多省电模式选项

## Unpublished

### 🛠 Breaking changes

### 🎉 New features

### 🐛 Bug fixes

### 💡 Others
