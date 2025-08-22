# Expo QQ Location Plugin 使用指南

## 插件功能

这个 config plugin 会自动配置您的 Expo 项目以使用腾讯地图定位 SDK。

## 功能包括：

### Android 配置
- ✅ 添加腾讯地图 API Key 到 AndroidManifest.xml
- ✅ 添加所有必需的位置权限
- ✅ 配置前台服务支持后台定位
- ✅ 添加网络和系统状态权限

### iOS 配置
- ✅ 添加腾讯地图 API Key 到 Info.plist（可选）

## 使用方法

### 1. 在 app.json 或 app.config.js 中配置

```json
{
  "expo": {
    "plugins": [
      [
        "expo-qq-location",
        {
          "apiKey": "your_android_api_key_here",
          "iosApiKey": "your_ios_api_key_here"
        }
      ]
    ]
  }
}
```

### 2. 权限说明

Plugin 会自动添加以下 Android 权限：

```xml
<!-- 基础定位权限 -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- 后台定位权限 (Android 10+) -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- 网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- WiFi 权限 -->
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />

<!-- 其他必需权限 -->
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

### 3. API Key 配置

Plugin 会在以下位置添加 API Key：

**Android (AndroidManifest.xml):**
```xml
<meta-data
    android:name="TENCENT_MAP_API_KEY"
    android:value="your_api_key_here" />
```

**iOS (Info.plist):**
```xml
<key>TENCENT_MAP_API_KEY</key>
<string>your_ios_api_key_here</string>
```

### 4. 前台服务配置

Plugin 会自动添加腾讯地图SDK的前台服务配置：

```xml
<service
    android:name="com.tencent.map.geolocation.s"
    android:foregroundServiceType="location" />
```

## 代码使用示例

```typescript
import ExpoQqLocationModule, {
  addLocationListener,
  addLocationErrorListener,
  setUserAgreePrivacy,
  startLocationUpdates,
  RequestLevel,
  LocationMode
} from 'expo-qq-location';

// 1. 设置隐私协议同意（必须）
setUserAgreePrivacy(true);

// 2. 添加定位监听器
const locationSubscription = addLocationListener((event) => {
  console.log('定位成功:', {
    latitude: event.latitude,
    longitude: event.longitude,
    address: event.address,
  });
});

// 3. 开始定位
const result = await startLocationUpdates({
  interval: 5000,
  requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
  allowGPS: true,
  locMode: LocationMode.HIGH_ACCURACY_MODE
});

// 4. 清理
locationSubscription?.remove();
```

## 注意事项

1. **隐私协议**: 必须在使用任何定位功能前调用 `setUserAgreePrivacy(true)`
2. **权限请求**: Android 6.0+ 需要在运行时请求位置权限
3. **后台定位**: Android 10+ 需要额外的后台位置权限
4. **API Key**: 确保从腾讯地图开放平台获取正确的 API Key
