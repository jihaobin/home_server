# Expo QQ Location 使用指南

## 目录

- [快速开始](#快速开始)
- [完整示例](#完整示例)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

## 快速开始

### 1. 基础设置

在使用任何定位功能之前，必须先设置隐私协议同意：

```typescript
import { setUserAgreePrivacy } from 'expo-qq-location';

// 在应用启动时调用
setUserAgreePrivacy(true);
```

### 2. 基础定位

```typescript
import {
  startLocationUpdates,
  addLocationListener,
  RequestLevel
} from 'expo-qq-location';

// 添加监听器
const subscription = addLocationListener((event) => {
  console.log('位置:', event.latitude, event.longitude);
  console.log('地址:', event.address);
});

// 开始定位
const result = await startLocationUpdates({
  interval: 5000,
  requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA
});

// 清理
subscription.remove();
```

## 完整示例

### React Hook 封装

```typescript
import { useEffect, useState, useCallback } from 'react';
import {
  LocationChangedEvent,
  LocationErrorEvent,
  setUserAgreePrivacy,
  setDeviceID,
  startLocationUpdates,
  stopLocationUpdates,
  addLocationListener,
  addLocationErrorListener,
  hasLocationPermission,
  requestLocationPermission,
  RequestLevel,
  LocationMode
} from 'expo-qq-location';

export function useQqLocation() {
  const [location, setLocation] = useState<LocationChangedEvent | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 初始化
    setUserAgreePrivacy(true);
    setDeviceID('unique-device-id');

    // 监听器
    const locationSub = addLocationListener((event) => {
      setLocation(event);
      setError(null);
    });

    const errorSub = addLocationErrorListener((event) => {
      setError(event.reason);
    });

    return () => {
      locationSub?.remove();
      errorSub?.remove();
      if (isLocating) {
        stopLocationUpdates();
      }
    };
  }, [isLocating]);

  const startLocation = useCallback(async () => {
    try {
      // 检查权限
      const hasPermission = await hasLocationPermission();
      if (!hasPermission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          throw new Error('定位权限被拒绝');
        }
      }

      setIsLocating(true);
      setError(null);

      const result = await startLocationUpdates({
        interval: 3000,
        requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
        allowGPS: true,
        allowDirection: true,
        indoorLocationMode: true,
        locMode: LocationMode.HIGH_ACCURACY_MODE,
        gpsFirst: true,
        gpsTimeOut: 8000
      });

      if (result !== 0) {
        throw new Error(`定位启动失败，错误码: ${result}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动定位失败');
      setIsLocating(false);
    }
  }, []);

  const stopLocation = useCallback(() => {
    stopLocationUpdates();
    setIsLocating(false);
  }, []);

  return {
    location,
    isLocating,
    error,
    startLocation,
    stopLocation
  };
}
```

### 在组件中使用

```typescript
import React from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { useQqLocation } from './useQqLocation';

export function LocationComponent() {
  const { location, isLocating, error, startLocation, stopLocation } = useQqLocation();

  const handleStart = async () => {
    try {
      await startLocation();
    } catch (err) {
      Alert.alert('错误', err.message);
    }
  };

  return (
    <View>
      <Text>状态: {isLocating ? '定位中' : '未定位'}</Text>
      {error && <Text style={{ color: 'red' }}>错误: {error}</Text>}

      {location && (
        <View>
          <Text>纬度: {location.latitude}</Text>
          <Text>经度: {location.longitude}</Text>
          <Text>地址: {location.address}</Text>
        </View>
      )}

      <Button
        title={isLocating ? "停止定位" : "开始定位"}
        onPress={isLocating ? stopLocation : handleStart}
      />
    </View>
  );
}
```

## 最佳实践

### 1. 权限处理

```typescript
const checkAndRequestPermission = async () => {
  // 先检查权限
  const hasPermission = await hasLocationPermission();

  if (!hasPermission) {
    // 请求权限
    const granted = await requestLocationPermission();

    if (!granted) {
      // 引导用户手动开启权限
      Alert.alert(
        '权限提示',
        '定位功能需要位置权限，请在设置中手动开启',
        [
          { text: '取消', style: 'cancel' },
          { text: '去设置', onPress: () => {
            // 引导到设置页面
            Linking.openSettings();
          }}
        ]
      );
      return false;
    }
  }

  return true;
};
```

### 2. 错误处理

```typescript
const handleLocationError = (error: LocationErrorEvent) => {
  let message = '定位失败';

  switch (error.error) {
    case ErrorCodes.ERROR_NETWORK:
      message = '网络错误，请检查网络连接';
      break;
    case ErrorCodes.ERROR_BAD_JSON:
      message = '定位信号不佳，请到空旷地区重试';
      break;
    case ErrorCodes.ERROR_WGS84:
      message = '坐标转换失败';
      break;
    default:
      message = `定位失败: ${error.reason}`;
  }

  Alert.alert('定位错误', message);
};
```

### 3. 定位配置优化

```typescript
// 高精度定位配置
const highAccuracyConfig = {
  interval: 3000,
  requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
  allowGPS: true,
  allowDirection: true,
  indoorLocationMode: true,
  locMode: LocationMode.HIGH_ACCURACY_MODE,
  gpsFirst: true,
  gpsTimeOut: 8000
};

// 省电模式配置
const powerSaveConfig = {
  interval: 10000,
  requestLevel: RequestLevel.REQUEST_LEVEL_GEO,
  allowGPS: false,
  locMode: LocationMode.ONLY_NETWORK_MODE
};

// 根据需求选择配置
const config = highPrecision ? highAccuracyConfig : powerSaveConfig;
```

### 4. 生命周期管理

```typescript
useEffect(() => {
  // 组件挂载时初始化
  setUserAgreePrivacy(true);

  const locationSub = addLocationListener(handleLocationUpdate);
  const errorSub = addLocationErrorListener(handleLocationError);

  // 组件卸载时清理
  return () => {
    locationSub?.remove();
    errorSub?.remove();
    stopLocationUpdates(); // 停止定位
  };
}, []);
```

## 常见问题

### Q: 为什么调用定位方法没有反应？

A: 请确保已经调用了 `setUserAgreePrivacy(true)`，这是使用定位功能的前提条件。

### Q: 定位精度不够怎么办？

A: 尝试以下配置：

- 设置 `allowGPS: true`
- 使用 `LocationMode.HIGH_ACCURACY_MODE`
- 开启 `gpsFirst: true`
- 设置较长的 `gpsTimeOut`

### Q: 在室内定位不准确？

A: 开启室内定位模式：

```typescript
{
  indoorLocationMode: true,
  locMode: LocationMode.HIGH_ACCURACY_MODE
}
```

### Q: 如何处理Android权限？

A: 模块会自动处理大部分权限配置，但运行时权限需要手动处理：

```typescript
const hasPermission = await hasLocationPermission();
if (!hasPermission) {
  await requestLocationPermission();
}
```

### Q: 如何获取更详细的地址信息？

A: 使用更高的请求级别：

```typescript
{
  requestLevel: RequestLevel.REQUEST_LEVEL_POI // 包含POI信息
}
```

### Q: 定位消耗电量太大怎么办？

A: 优化配置：

- 增加定位间隔 `interval`
- 使用网络定位 `ONLY_NETWORK_MODE`
- 关闭不必要的功能如方向感应

### Q: 后台定位如何配置？

A: Config Plugin会自动配置后台定位权限，但需要注意：

- Android 10+ 需要额外的后台位置权限
- 某些设备厂商可能有额外限制
- 建议引导用户手动设置应用为"始终允许"位置权限
