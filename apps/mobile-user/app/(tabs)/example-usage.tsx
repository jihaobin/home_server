import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, ScrollView } from 'react-native';
import ExpoQqLocationModule, {
  LocationChangedEvent,
  LocationErrorEvent,
  LocationStatusEvent,
  LocationRequest,
  RequestLevel,
  LocationMode,
  ErrorCodes,
  setUserAgreePrivacy,
  setDeviceID,
  startLocationUpdates,
  stopLocationUpdates,
  hasLocationPermission,
  requestLocationPermission,
  getApiKey,
  addLocationListener,
  addLocationErrorListener,
  addStatusUpdateListener,
  removeAllLocationListeners
} from 'expo-qq-location';

export default function ExampleUsage() {
  const [location, setLocation] = useState<LocationChangedEvent | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('未开始定位');
  const [apiKey, setApiKey] = useState<string>('');

  useEffect(() => {
    // 设置用户同意隐私协议（必须）
    setUserAgreePrivacy(true);

    // 获取API Key
    const key = getApiKey();
    setApiKey(key);

    // 设置设备ID（可选）
    setDeviceID('expo-qq-location-device-id');

    // 添加定位成功监听器
    const locationSubscription = addLocationListener((event: LocationChangedEvent) => {
      setLocation(event);
      setLocationStatus('定位成功');
    });

    // 添加定位错误监听器
    const errorSubscription = addLocationErrorListener((event: LocationErrorEvent) => {
      setLocationStatus(`定位失败: ${event.reason}`);
      Alert.alert('定位失败', event.reason);
    });

    // 添加状态监听器
    const statusSubscription = addStatusUpdateListener((event: LocationStatusEvent) => {
      console.log('状态更新:', event);
    });

    return () => {
      // 清理监听器
      locationSubscription?.remove();
      errorSubscription?.remove();
      statusSubscription?.remove();
      // 停止定位
      stopLocationUpdates();
      removeAllLocationListeners();
    };
  }, []);

  const handleStartContinuousLocation = async () => {
    try {
      // 检查权限
      const hasPermission = await hasLocationPermission();
      if (!hasPermission) {
        // 尝试请求权限
        const permissionGranted = await requestLocationPermission();
        if (!permissionGranted) {
          Alert.alert('权限提示', '请在设置中授予定位权限');
          return;
        }
      }

      setIsLocating(true);
      setLocationStatus('开始连续定位...');

      // 开始连续定位
      const result = await startLocationUpdates({
        interval: 3000, // 3秒间隔
        requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
        allowGPS: true,
        allowDirection: true,
        indoorLocationMode: true,
        locMode: LocationMode.HIGH_ACCURACY_MODE,
        gpsFirst: false,
        gpsTimeOut: 8000,
      });

      if (result === 0) {
        setLocationStatus('连续定位已启动');
      } else {
        setIsLocating(false);
        setLocationStatus(`启动定位失败，错误码: ${result}`);
        Alert.alert('错误', `启动定位失败，错误码: ${result}`);
      }
    } catch (error) {
      setIsLocating(false);
      setLocationStatus('启动定位失败');
      Alert.alert('错误', `启动定位失败: ${error}`);
    }
  };

  const handleStopLocation = () => {
    try {
      stopLocationUpdates();
      setIsLocating(false);
      setLocationStatus('定位已停止');
    } catch (error) {
      Alert.alert('错误', `停止定位失败: ${error}`);
    }
  };

  const handleGetCurrentLocation = () => {
    // 注意：当前实现的模块只支持连续定位，没有单次定位功能
    Alert.alert('提示', '当前模块只支持连续定位功能');
  };

  const handleEnableBackgroundLocation = () => {
    // 注意：当前实现的模块不包含后台定位的单独控制
    Alert.alert('提示', '后台定位通过权限配置自动启用');
  };

  const handleDisableBackgroundLocation = () => {
    // 注意：当前实现的模块不包含后台定位的单独控制
    Alert.alert('提示', '后台定位通过权限配置控制');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>腾讯地图定位 SDK 示例</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Key</Text>
        <Text style={styles.text}>{apiKey || '未配置'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>定位状态</Text>
        <Text style={styles.text}>{locationStatus}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>位置信息</Text>
        {location ? (
          <View>
            <Text style={styles.text}>经度: {location.longitude?.toFixed(6)}</Text>
            <Text style={styles.text}>纬度: {location.latitude?.toFixed(6)}</Text>
            <Text style={styles.text}>精度: {location.accuracy?.toFixed(2)} 米</Text>
            <Text style={styles.text}>海拔: {location.altitude?.toFixed(2)} 米</Text>
            <Text style={styles.text}>时间戳: {new Date(location.timestamp).toLocaleString()}</Text>
            {location.address && <Text style={styles.text}>地址: {location.address}</Text>}
            {location.name && <Text style={styles.text}>地点名称: {location.name}</Text>}
            {location.nation && <Text style={styles.text}>国家: {location.nation}</Text>}
            {location.province && <Text style={styles.text}>省份: {location.province}</Text>}
            {location.city && <Text style={styles.text}>城市: {location.city}</Text>}
            {location.district && <Text style={styles.text}>区县: {location.district}</Text>}
            {location.town && <Text style={styles.text}>城镇: {location.town}</Text>}
            {location.village && <Text style={styles.text}>村庄: {location.village}</Text>}
            {location.street && <Text style={styles.text}>街道: {location.street}</Text>}
            {location.streetNo && <Text style={styles.text}>门牌号: {location.streetNo}</Text>}
            {location.speed !== undefined && <Text style={styles.text}>速度: {location.speed.toFixed(2)} m/s</Text>}
            {location.bearing !== undefined && <Text style={styles.text}>方向: {location.bearing.toFixed(2)}°</Text>}
            {location.poiList && location.poiList.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.text, { fontWeight: 'bold' }]}>附近POI:</Text>
                {location.poiList.slice(0, 3).map((poi, index) => (
                  <Text key={index} style={styles.text}>• {poi.name} - {poi.address}</Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.text}>暂无位置信息</Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="开始连续定位"
          onPress={handleStartContinuousLocation}
          disabled={isLocating}
        />

        <View style={styles.buttonSpace} />

        <Button
          title="停止定位"
          onPress={handleStopLocation}
          disabled={!isLocating}
        />

        <View style={styles.buttonSpace} />

        <Button
          title="获取单次定位（暂不支持）"
          onPress={handleGetCurrentLocation}
          disabled={true}
        />

        <View style={styles.buttonSpace} />

        <Button
          title="后台定位说明"
          onPress={handleEnableBackgroundLocation}
        />

        <View style={styles.buttonSpace} />

        <Button
          title="权限配置说明"
          onPress={handleDisableBackgroundLocation}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 5,
  },
  buttonContainer: {
    marginTop: 20,
  },
  buttonSpace: {
    height: 10,
  },
});
