# 高精度定位系统使用指南

## 概述

本系统已从高德地图切换为腾讯地图，并集成了高精度定位解决方案，专门针对中国地区进行了优化。

## 主要特性

### 🎯 高精度定位
- **多重定位策略**: 结合GPS、网络定位和缓存位置
- **智能精度筛选**: 自动过滤精度差的位置数据
- **实时精度显示**: 显示当前定位精度等级
- **中国坐标系适配**: 自动转换WGS84到GCJ02坐标系

### 🗺️ 腾讯地图集成
- **原生地图渲染**: 使用腾讯地图JavaScript API
- **实时位置标记**: 在地图上显示当前位置
- **精度可视化**: 通过圆圈显示定位精度范围
- **地图交互**: 支持点击选点功能

### 📊 坐标系转换
- **WGS84**: GPS原始坐标
- **GCJ02**: 火星坐标系（高德、腾讯使用）
- **BD09**: 百度坐标系
- **API转换**: 通过后端腾讯地图API进行精确转换

## 安装依赖

确保已安装以下依赖：

```bash
# 定位相关依赖（已包含在项目中）
expo install expo-location react-native-webview
```

## 使用方法

### 基础位置获取

```typescript
import { useHighAccuracyLocation } from '@/lib/location-utils';

const { getCurrentPosition } = useHighAccuracyLocation();

// 获取单次高精度位置
const location = await getCurrentPosition({
  accuracy: 6, // BestForNavigation
  timeout: 15000,
  maximumAge: 5000,
});

console.log('原始坐标 (WGS84):', location.latitude, location.longitude);
console.log('火星坐标 (GCJ02):', location.gcj02);
console.log('百度坐标 (BD09):', location.bd09);
console.log('精度:', location.accuracy, '米');
```

### 持续位置跟踪

```typescript
const { startWatching, stopWatching } = useHighAccuracyLocation();

// 开始位置跟踪
startWatching((location) => {
  console.log('位置更新:', location);
}, {
  accuracy: 6,
  timeInterval: 2000, // 2秒更新一次
  distanceInterval: 5, // 移动5米更新
});

// 停止跟踪
stopWatching();
```

### 腾讯地图组件

```tsx
import TencentMap from '@/components/TencentMap';

<TencentMap
  onLocationUpdate={(location) => {
    console.log('地图位置更新:', location);
  }}
  onLocationSelect={(data) => {
    console.log('用户选择位置:', data);
  }}
  showCurrentLocation={true}
  enableLocationPicker={true}
  apiKey="your-tencent-map-api-key"
/>
```

## 精度等级说明

| 精度范围 | 等级 | 适用场景 |
|---------|------|----------|
| ≤5米 | 极高精度 | 室外导航、精确定位 |
| ≤20米 | 高精度 | 一般导航、位置服务 |
| ≤100米 | 中等精度 | 大致位置、区域服务 |
| >100米 | 低精度 | 粗略位置 |

## 配置选项

### LocationConfig

```typescript
interface LocationConfig {
  accuracy: Location.LocationAccuracy;  // 定位精度
  enableHighAccuracy?: boolean;         // 启用高精度
  timeout?: number;                     // 超时时间(毫秒)
  maximumAge?: number;                  // 缓存时间(毫秒)
  distanceInterval?: number;            // 距离间隔(米)
  timeInterval?: number;                // 时间间隔(毫秒)
}
```

### 精度级别

- `LocationAccuracy.Lowest` (1): 最低精度，约3公里
- `LocationAccuracy.Low` (2): 低精度，约1公里
- `LocationAccuracy.Balanced` (3): 平衡精度，约100米
- `LocationAccuracy.High` (4): 高精度，约10米
- `LocationAccuracy.Highest` (5): 最高精度，约1米
- `LocationAccuracy.BestForNavigation` (6): 导航最佳精度

## 坐标系转换工具

```typescript
import { CoordinateConverter } from '@/lib/location-utils';

// 注意：坐标转换现在使用本地gcoord库，无需网络请求，速度更快

// WGS84 转 GCJ02 (腾讯坐标系) - 同步操作
const [lng, lat] = CoordinateConverter.wgs84ToGcj02(longitude, latitude);

// GCJ02 转 BD09 (百度坐标系) - 同步操作
const [baiduLng, baiduLat] = CoordinateConverter.gcj02ToBd09(longitude, latitude);

// GPS坐标转腾讯坐标的完整示例
try {
  const tencentCoords = CoordinateConverter.wgs84ToGcj02(
    116.397390, // WGS84经度
    39.909198   // WGS84纬度
  );
  console.log('腾讯坐标:', tencentCoords[0], tencentCoords[1]);
} catch (error) {
  console.error('坐标转换失败:', error);
  // 降级使用原始坐标
}

// 其他转换方法（均为同步操作）
// wgs84ToBd09, gcj02ToWgs84, bd09ToGcj02, bd09ToWgs84
```

## 性能优化策略

新版本采用了多级缓存策略来优化定位速度：

1. **缓存优先**: 优先使用5分钟内的高精度缓存位置
2. **系统缓存**: 如果缓存不可用，使用系统最后已知位置
3. **后台更新**: 返回缓存位置的同时，在后台异步更新精确位置
4. **降级策略**: 多级降级确保在各种网络条件下都能获得位置

```typescript
// 使用优化后的定位管理器
const locationManager = HighAccuracyLocationManager.getInstance();

// 预热位置服务（在应用启动时调用）
await locationManager.preWarmLocationServices();

// 快速获取位置（通常1-2秒内返回）
const location = await locationManager.getCurrentPosition({
  accuracy: Location.LocationAccuracy.High // 平衡速度和精度
});
```

## 权限配置

### Android权限 (android/app/src/main/AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

### iOS权限 (ios/ProjectName/Info.plist)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>此应用需要访问位置信息以提供定位服务</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>此应用需要访问位置信息以提供持续定位服务</string>
```

## 最佳实践

### 1. 权限处理
```typescript
const hasPermission = await locationManager.requestPermissions();
if (!hasPermission) {
  // 处理权限被拒绝的情况
  Alert.alert('权限需要', '请授权位置访问权限以使用定位功能');
  return;
}
```

### 2. 错误处理
```typescript
try {
  const location = await getCurrentPosition();
  // 处理成功获取的位置
} catch (error) {
  console.error('定位失败:', error);
  // 显示友好的错误信息给用户
}
```

### 3. 精度过滤
```typescript
startWatching((location) => {
  // 只处理精度足够的位置
  if (location.accuracy && location.accuracy <= 50) {
    // 处理高精度位置
    updateLocation(location);
  }
});
```

### 4. 中国地区适配
```typescript
// 在中国地区使用GCJ02坐标调用地图API
if (location.gcj02) {
  await reverseGeocode(location.gcj02.latitude, location.gcj02.longitude);
}
```

## 故障排除

### 定位精度差
1. 确保在室外开阔地带测试
2. 检查设备GPS设置是否启用
3. 尝试重启定位服务
4. 检查网络连接状态

### 地图显示偏移
1. 确认使用正确的坐标系（中国地区使用GCJ02）
2. 检查API密钥是否正确
3. 验证坐标转换是否正确

### 权限问题
1. 检查AndroidManifest.xml和Info.plist配置
2. 确认用户已授权位置权限
3. 测试前台和后台权限状态

## 性能优化建议

1. **合理设置更新频率**: 根据应用场景调整`timeInterval`和`distanceInterval`
2. **精度vs电量平衡**: 不是所有场景都需要最高精度
3. **及时停止监听**: 不需要时及时调用`stopWatching()`
4. **缓存策略**: 利用`maximumAge`减少重复定位请求

## 更新日志

### v1.0.0 (2025-08-12)
- ✅ 完成从高德地图到腾讯地图的迁移
- ✅ 集成高精度定位系统
- ✅ 添加坐标系自动转换
- ✅ 优化中国地区定位精度
- ✅ 添加实时精度显示
- ✅ 支持多种定位模式切换
