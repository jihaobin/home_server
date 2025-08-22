# Expo QQ Location

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android-green.svg)
![SDK](https://img.shields.io/badge/Tencent%20Location%20SDK-7.6.1-orange.svg)

🚀 一个基于腾讯地图定位SDK的Expo Native Module，为React Native应用提供高精度定位功能。

## ✨ 特性

- 🎯 **高精度定位** - 基于腾讯地图定位SDK v7.6.1
- 📱 **连续定位** - 支持按间隔连续获取位置信息
- 🏢 **丰富的地址信息** - 包含行政区划、POI等详细信息
- 🔒 **隐私合规** - 完全符合Android隐私政策要求
- ⚙️ **自动配置** - 内置Config Plugin自动配置权限和API Key
- 📊 **状态监听** - 实时监听GPS、WiFi、Cell状态变化
- 🔧 **TypeScript支持** - 完整的类型定义

## 📦 安装

```bash
npm install expo-qq-location
# 或
yarn add expo-qq-location
```

## 🛠️ 配置

### 1. 配置API Key

在您的 `app.json` 或 `app.config.js` 中添加plugin配置：

```json
{
  "expo": {
    "plugins": [
      [
        "expo-qq-location",
        {
          "apiKey": "your_tencent_map_api_key_here"
        }
      ]
    ]
  }
}
```

### 2. 重新构建项目

```bash
npx expo prebuild --clean
npx expo run:android
```

## 🚀 快速开始

```typescript
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import ExpoQqLocationModule, {
  LocationChangedEvent,
  setUserAgreePrivacy,
  startLocationUpdates,
  stopLocationUpdates,
  addLocationListener,
  addLocationErrorListener,
  RequestLevel,
  LocationMode
} from 'expo-qq-location';

export default function LocationExample() {
  const [location, setLocation] = useState<LocationChangedEvent | null>(null);

  useEffect(() => {
    // 1. 设置隐私协议同意（必须）
    setUserAgreePrivacy(true);

    // 2. 添加定位监听器
    const locationSubscription = addLocationListener((event) => {
      setLocation(event);
      console.log('定位成功:', event);
    });

    // 3. 添加错误监听器
    const errorSubscription = addLocationErrorListener((event) => {
      Alert.alert('定位失败', event.reason);
    });

    // 4. 开始定位
    const startLocation = async () => {
      try {
        const result = await startLocationUpdates({
          interval: 5000, // 5秒间隔
          requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
          allowGPS: true,
          locMode: LocationMode.HIGH_ACCURACY_MODE
        });

        if (result === 0) {
          console.log('定位启动成功');
        }
      } catch (error) {
        console.error('定位启动失败:', error);
      }
    };

    startLocation();

    // 5. 清理
    return () => {
      locationSubscription?.remove();
      errorSubscription?.remove();
      stopLocationUpdates();
    };
  }, []);

  return (
    // 您的UI组件
  );
}
```

## 📚 API 参考

### 核心方法

#### `setUserAgreePrivacy(isAgree: boolean)`

设置用户是否同意隐私协议（必须先调用）

```typescript
setUserAgreePrivacy(true);
```

#### `setDeviceID(deviceId: string)`

设置设备唯一标识（可选）

```typescript
setDeviceID('unique-device-id');
```

#### `startLocationUpdates(request?: LocationRequest): Promise<number>`

开始连续定位

```typescript
const result = await startLocationUpdates({
  interval: 3000,                                    // 定位间隔（毫秒）
  requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA, // 请求级别
  allowGPS: true,                                    // 允许GPS
  allowDirection: true,                              // 获取方向信息
  indoorLocationMode: true,                          // 室内定位
  locMode: LocationMode.HIGH_ACCURACY_MODE,          // 定位模式
  gpsFirst: true,                                    // GPS优先
  gpsTimeOut: 8000                                   // GPS超时时间
});
```

#### `stopLocationUpdates()`

停止定位

```typescript
stopLocationUpdates();
```

#### `hasLocationPermission(): Promise<boolean>`

检查是否有定位权限

```typescript
const hasPermission = await hasLocationPermission();
```

#### `requestLocationPermission(): Promise<boolean>`

请求定位权限

```typescript
const granted = await requestLocationPermission();
```

### 事件监听

#### `addLocationListener(listener): Subscription`

监听定位成功事件

```typescript
const subscription = addLocationListener((event: LocationChangedEvent) => {
  console.log('纬度:', event.latitude);
  console.log('经度:', event.longitude);
  console.log('地址:', event.address);
});
```

#### `addLocationErrorListener(listener): Subscription`

监听定位错误事件

```typescript
const subscription = addLocationErrorListener((event: LocationErrorEvent) => {
  console.log('错误码:', event.error);
  console.log('错误描述:', event.reason);
});
```

#### `addStatusUpdateListener(listener): Subscription`

监听状态更新事件

```typescript
const subscription = addStatusUpdateListener((event: LocationStatusEvent) => {
  console.log('设备名:', event.name);
  console.log('状态:', event.status);
});
```

### 类型定义

#### `LocationChangedEvent`

```typescript
type LocationChangedEvent = {
  latitude: number;          // 纬度
  longitude: number;         // 经度
  altitude: number;          // 海拔
  accuracy: number;          // 精度（米）
  bearing: number;           // 方向角
  speed: number;             // 速度
  timestamp: number;         // 时间戳

  // 地址信息（可选）
  nation?: string;           // 国家
  province?: string;         // 省份
  city?: string;             // 城市
  district?: string;         // 区县
  town?: string;             // 城镇
  village?: string;          // 村庄
  street?: string;           // 街道
  streetNo?: string;         // 门牌号
  name?: string;             // 地点名称
  address?: string;          // 详细地址

  // POI信息（可选）
  poiList?: Array<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }>;
};
```

#### `LocationRequest`

```typescript
type LocationRequest = {
  interval?: number;          // 定位间隔（毫秒，最小1000）
  requestLevel?: number;      // 请求级别（0-4）
  allowGPS?: boolean;         // 是否允许GPS
  allowDirection?: boolean;   // 是否获取方向
  indoorLocationMode?: boolean; // 室内定位模式
  locMode?: number;           // 定位模式（0-2）
  gpsFirst?: boolean;         // GPS优先
  gpsTimeOut?: number;        // GPS超时时间（毫秒）
};
```

### 常量

#### 请求级别

```typescript
RequestLevel.REQUEST_LEVEL_GEO        // 0: 仅坐标
RequestLevel.REQUEST_LEVEL_NAME       // 1: 坐标+地址
RequestLevel.REQUEST_LEVEL_ADMIN_AREA // 3: 坐标+行政区划
RequestLevel.REQUEST_LEVEL_POI        // 4: 坐标+行政区划+POI
```

#### 定位模式

```typescript
LocationMode.HIGH_ACCURACY_MODE  // 0: 高精度模式
LocationMode.ONLY_NETWORK_MODE   // 1: 仅网络定位
LocationMode.ONLY_GPS_MODE       // 2: 仅GPS定位
```

#### 错误码

```typescript
ErrorCodes.ERROR_OK       // 0: 定位成功
ErrorCodes.ERROR_NETWORK  // 1: 网络错误
ErrorCodes.ERROR_BAD_JSON // 2: GPS/WiFi/基站错误
ErrorCodes.ERROR_WGS84    // 4: 坐标转换错误
ErrorCodes.ERROR_UNKNOWN  // 404: 未知错误
```

## 🔧 配置选项

### Config Plugin 选项

| 选项 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `apiKey` | string | ✅ | 腾讯地图Android API Key |
| `iosApiKey` | string | ❌ | 腾讯地图iOS API Key（未来支持） |

### 自动配置的权限

Plugin会自动添加以下Android权限：

```xml
<!-- 基础定位权限 -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- 网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />

<!-- 系统权限 -->
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

## ⚠️ 注意事项

### 隐私合规

1. **必须先调用** `setUserAgreePrivacy(true)` 才能使用定位功能
2. Android 6.0+ 需要在运行时请求位置权限
3. Android 10+ 需要额外的后台位置权限

### 权限处理

```typescript
// 检查并请求权限
const checkPermissions = async () => {
  const hasPermission = await hasLocationPermission();
  if (!hasPermission) {
    const granted = await requestLocationPermission();
    if (!granted) {
      Alert.alert('权限提示', '请在设置中授予定位权限');
      return false;
    }
  }
  return true;
};
```

### API Key获取

1. 访问 [腾讯位置服务](https://lbs.qq.com/)
2. 注册账号并创建应用
3. 获取Android平台的API Key
4. 在app.json中配置API Key

## 🐛 故障排除

### 常见问题

#### 1. 定位失败

```typescript
// 检查是否设置了隐私协议
setUserAgreePrivacy(true);

// 检查API Key是否正确
const apiKey = getApiKey();
console.log('API Key:', apiKey);
```

#### 2. 权限被拒绝

```typescript
// 检查权限状态
const hasPermission = await hasLocationPermission();
if (!hasPermission) {
  // 引导用户到设置页面
}
```

#### 3. 模块未找到

```bash
# 重新构建项目
npx expo prebuild --clean
npx expo run:android
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

- 📧 邮箱: <2644263665@qq.com>
- 🐛 问题反馈: [GitHub Issues](https://github.com/jihaobin/expo-qq-location/issues)

---

⭐ 如果这个项目对您有帮助，请给个星星支持一下！
