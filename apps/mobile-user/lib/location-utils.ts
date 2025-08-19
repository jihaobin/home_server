import * as Location from 'expo-location';
import { Platform } from 'react-native';
import gcoord from 'gcoord';

export interface LocationConfig {
  accuracy: Location.LocationAccuracy;
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceInterval?: number;
  timeInterval?: number;
}

export interface EnhancedLocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
  provider?: string;
  // 坐标系转换后的坐标
  gcj02?: { latitude: number; longitude: number };
  bd09?: { latitude: number; longitude: number };
}

/**
 * 高精度定位管理器（性能优化版本）
 * 支持多种定位方式和坐标系转换，优化定位速度
 */
export class HighAccuracyLocationManager {
  private static instance: HighAccuracyLocationManager;
  private currentWatcher: Location.LocationSubscription | null = null;
  private lastKnownLocation: EnhancedLocationData | null = null;
  private isWatching: boolean = false;

  // 缓存配置
  private readonly CACHE_MAX_AGE = 5 * 60 * 1000; // 5分钟
  private readonly FALLBACK_MAX_AGE = 30 * 60 * 1000; // 30分钟
  private readonly HIGH_ACCURACY_THRESHOLD = 50; // 50米内认为是高精度

  private constructor() {}

  public static getInstance(): HighAccuracyLocationManager {
    if (!HighAccuracyLocationManager.instance) {
      HighAccuracyLocationManager.instance = new HighAccuracyLocationManager();
    }
    return HighAccuracyLocationManager.instance;
  }

  /**
   * 请求位置权限
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // 请求前台权限
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        console.warn('前台位置权限被拒绝');
        return false;
      }

      // 如果是Android，尝试请求后台权限以获得更好的定位
      if (Platform.OS === 'android') {
        try {
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus === 'granted') {
            console.log('后台位置权限已获得，定位精度将更高');
          }
        } catch (error) {
          console.log('后台权限请求失败，但前台权限足够基本使用');
        }
      }

      // 启用网络定位提供程序
      try {
        await Location.enableNetworkProviderAsync();
      } catch (error) {
        console.log('网络定位提供程序启用失败，但不影响基本功能');
      }

      return true;
    } catch (error) {
      console.error('请求位置权限失败:', error);
      return false;
    }
  }

  /**
   * 获取单次高精度位置（性能优化版本）
   * 优先使用缓存位置，然后异步更新精确位置
   */
  async getCurrentPosition(config?: LocationConfig): Promise<EnhancedLocationData> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('位置权限未授权');
    }

    try {
      // 1. 优先尝试获取最后已知的位置（快速响应）
      const cachedLocation = await this.getLastKnownFromCache();
      if (cachedLocation) {
        console.log('使用缓存的高精度位置，同时在后台更新');
        // 在后台异步更新位置
        this.updateLocationInBackground(config);
        return cachedLocation;
      }

      // 2. 如果没有可用缓存，尝试获取系统最后已知位置
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: this.FALLBACK_MAX_AGE,
        requiredAccuracy: 200, // 200米精度内可接受
      });

      if (lastKnown && this.isLocationAccurate(lastKnown)) {
        const enhanced = await this.enhanceLocationData(lastKnown);
        this.lastKnownLocation = enhanced;
        console.log('使用系统缓存位置，同时在后台更新');
        // 在后台异步更新更精确的位置
        this.updateLocationInBackground(config);
        return enhanced;
      }

      // 3. 如果缓存都不可用，获取当前位置
      console.log('缓存不可用，获取实时位置');
      const currentLocation = await this.getCurrentPositionDirect(config);
      return currentLocation;

    } catch (error) {
      console.error('获取当前位置失败:', error);

      // 4. 最后的降级策略：使用任何可用的位置
      if (this.lastKnownLocation) {
        console.log('使用最后已知位置作为降级方案');
        return this.lastKnownLocation;
      }

      throw error;
    }
  }

  /**
   * 直接获取当前位置（高精度）
   */
  private async getCurrentPositionDirect(config?: LocationConfig): Promise<EnhancedLocationData> {
    const locationConfig: Location.LocationOptions = {
      accuracy: config?.accuracy || Location.LocationAccuracy.High, // 使用High而不是Highest以平衡速度和精度
      ...(Platform.OS === 'android' && {
        timeInterval: 1000, // Android 1秒超时
        mayShowUserSettingsDialog: false, // 避免弹出设置对话框
      }),
    };

    const currentLocation = await Location.getCurrentPositionAsync(locationConfig);
    const enhanced = await this.enhanceLocationData(currentLocation);
    this.lastKnownLocation = enhanced;
    return enhanced;
  }

  /**
   * 在后台异步更新位置
   */
  private async updateLocationInBackground(config?: LocationConfig): Promise<void> {
    try {
      const updated = await this.getCurrentPositionDirect(config);
      this.lastKnownLocation = updated;
      console.log('后台位置更新完成');
    } catch (error) {
      console.log('后台位置更新失败:', error);
    }
  }

  /**
   * 从缓存获取最后已知位置
   */
  private async getLastKnownFromCache(): Promise<EnhancedLocationData | null> {
    if (!this.lastKnownLocation) {
      return null;
    }

    const age = Date.now() - this.lastKnownLocation.timestamp;
    if (age > this.CACHE_MAX_AGE) {
      return null;
    }

    // 检查精度是否足够
    if (this.lastKnownLocation.accuracy && this.lastKnownLocation.accuracy > this.HIGH_ACCURACY_THRESHOLD) {
      return null;
    }

    return this.lastKnownLocation;
  }

  /**
   * 开始持续位置监听（优化版本）
   */
  async startWatching(
    callback: (location: EnhancedLocationData) => void,
    config?: LocationConfig
  ): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('位置权限未授权');
    }

    // 停止之前的监听
    if (this.currentWatcher) {
      this.currentWatcher.remove();
    }

    // 先提供快速响应
    try {
      const quickLocation = await this.getCurrentPosition(config);
      callback(quickLocation);
    } catch (error) {
      console.log('快速位置获取失败，继续监听更新');
    }

    const watchConfig: Location.LocationOptions = {
      accuracy: config?.accuracy || Location.LocationAccuracy.High, // 平衡精度和速度
        timeInterval: config?.timeInterval || 1000 * 60 * 5, // 5分钟更新一次
        distanceInterval: config?.distanceInterval || 100, // 移动100米更新
    };

    try {
      this.isWatching = true;
      this.currentWatcher = await Location.watchPositionAsync(
        watchConfig,
        async (location) => {
          // 过滤掉精度太差的位置
          if (location.coords.accuracy && location.coords.accuracy > 300) {
            console.log('位置精度太差，忽略此次更新');
            return;
          }

          const enhanced = await this.enhanceLocationData(location);

          // 比较并选择更精确的位置
          if (this.shouldUpdateLocation(enhanced)) {
            this.lastKnownLocation = enhanced;
            callback(enhanced);
          }
        }
      );
    } catch (error) {
      console.error('开始位置监听失败:', error);
      this.isWatching = false;
      throw error;
    }
  }

  /**
   * 判断是否应该更新位置
   */
  private shouldUpdateLocation(newLocation: EnhancedLocationData): boolean {
    if (!this.lastKnownLocation) {
      return true;
    }

    // 如果新位置更精确，则更新
      const newAccuracy = newLocation.accuracy ?? 1e6;
      const oldAccuracy = this.lastKnownLocation.accuracy ?? 1e6;

    if (newAccuracy < oldAccuracy * 0.8) { // 精度提升20%以上才更新
      return true;
    }

    // 如果时间间隔足够长，也更新
    const timeDiff = newLocation.timestamp - this.lastKnownLocation.timestamp;
    if (timeDiff > 5000) { // 5秒以上
      return true;
    }

    return false;
  }

  /**
   * 停止位置监听
   */
  stopWatching(): void {
    if (this.currentWatcher) {
      this.currentWatcher.remove();
      this.currentWatcher = null;
      this.isWatching = false;
    }
  }

  /**
   * 增强位置数据，添加坐标转换（使用本地gcoord库）
   */
  private async enhanceLocationData(location: Location.LocationObject): Promise<EnhancedLocationData> {
    const { coords, timestamp } = location;

    let gcj02 = { latitude: coords.latitude, longitude: coords.longitude };
    let bd09 = { latitude: coords.latitude, longitude: coords.longitude };

    try {
      // 使用gcoord进行本地坐标转换（速度更快，无网络依赖）

      // WGS84 -> GCJ02 (腾讯地图坐标系)
      const gcj02Result = gcoord.transform([coords.longitude, coords.latitude], gcoord.WGS84, gcoord.GCJ02);
      gcj02 = {
        latitude: gcj02Result[1],
        longitude: gcj02Result[0],
      };

      // WGS84 -> BD09 (百度地图坐标系)
      const bd09Result = gcoord.transform([coords.longitude, coords.latitude], gcoord.WGS84, gcoord.BD09);
      bd09 = {
        latitude: bd09Result[1],
        longitude: bd09Result[0],
      };

    } catch (error) {
      console.error('坐标转换失败，使用原始坐标:', error);
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude || undefined,
      accuracy: coords.accuracy || undefined,
      altitudeAccuracy: coords.altitudeAccuracy || undefined,
      heading: coords.heading || undefined,
      speed: coords.speed || undefined,
      timestamp,
      provider: Platform.OS === 'ios' ? 'CoreLocation' : 'FusedLocationProvider',
      gcj02,
      bd09,
    };
  }

  /**
   * 判断位置是否足够精确
   */
  private isLocationAccurate(location: Location.LocationObject): boolean {
      return (location.coords.accuracy ?? 999999) <= this.HIGH_ACCURACY_THRESHOLD;
  }

  /**
   * 获取最后已知位置
   */
  getLastKnownLocation(): EnhancedLocationData | null {
    return this.lastKnownLocation;
  }

  /**
   * 检查是否正在监听位置
   */
  isWatchingLocation(): boolean {
    return this.isWatching;
  }

  /**
   * 预热位置服务（在应用启动时调用）
   */
  async preWarmLocationServices(): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return;
      }

      // 在后台获取一次位置以预热GPS
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: this.FALLBACK_MAX_AGE,
      });

      if (lastKnown) {
        this.lastKnownLocation = await this.enhanceLocationData(lastKnown);
        console.log('位置服务预热完成');
      }
    } catch (error) {
      console.log('位置服务预热失败:', error);
    }
  }
}

/**
 * 坐标转换工具函数（使用本地gcoord库）
 */
export class CoordinateConverter {
  /**
   * WGS84 转 GCJ02 (火星坐标系)
   */
  static wgs84ToGcj02(longitude: number, latitude: number): [number, number] {
    try {
      const result = gcoord.transform([longitude, latitude], gcoord.WGS84, gcoord.GCJ02);
      return [result[0], result[1]];
    } catch (error) {
      console.error('WGS84转GCJ02失败:', error);
      return [longitude, latitude];
    }
  }

  /**
   * WGS84 转 BD09 (百度坐标系)
   */
  static wgs84ToBd09(longitude: number, latitude: number): [number, number] {
    try {
      const result = gcoord.transform([longitude, latitude], gcoord.WGS84, gcoord.BD09);
      return [result[0], result[1]];
    } catch (error) {
      console.error('WGS84转BD09失败:', error);
      return [longitude, latitude];
    }
  }

  /**
   * GCJ02 转 WGS84
   */
  static gcj02ToWgs84(longitude: number, latitude: number): [number, number] {
    try {
      const result = gcoord.transform([longitude, latitude], gcoord.GCJ02, gcoord.WGS84);
      return [result[0], result[1]];
    } catch (error) {
      console.error('GCJ02转WGS84失败:', error);
      return [longitude, latitude];
    }
  }

  /**
   * GCJ02 转 BD09
   */
  static gcj02ToBd09(longitude: number, latitude: number): [number, number] {
    try {
      const result = gcoord.transform([longitude, latitude], gcoord.GCJ02, gcoord.BD09);
      return [result[0], result[1]];
    } catch (error) {
      console.error('GCJ02转BD09失败:', error);
      return [longitude, latitude];
    }
  }

  /**
   * BD09 转 GCJ02
   */
  static bd09ToGcj02(longitude: number, latitude: number): [number, number] {
    try {
      const result = gcoord.transform([longitude, latitude], gcoord.BD09, gcoord.GCJ02);
      return [result[0], result[1]];
    } catch (error) {
      console.error('BD09转GCJ02失败:', error);
      return [longitude, latitude];
    }
  }

  /**
   * BD09 转 WGS84
   */
  static bd09ToWgs84(longitude: number, latitude: number): [number, number] {
    try {
      const result = gcoord.transform([longitude, latitude], gcoord.BD09, gcoord.WGS84);
      return [result[0], result[1]];
    } catch (error) {
      console.error('BD09转WGS84失败:', error);
      return [longitude, latitude];
    }
  }
}

/**
 * 便捷的 Hook 风格 API
 */
export const useHighAccuracyLocation = () => {
  const locationManager = HighAccuracyLocationManager.getInstance();

  return {
    getCurrentPosition: (config?: LocationConfig) => locationManager.getCurrentPosition(config),
    startWatching: (callback: (location: EnhancedLocationData) => void, config?: LocationConfig) =>
      locationManager.startWatching(callback, config),
    stopWatching: () => locationManager.stopWatching(),
    getLastKnownLocation: () => locationManager.getLastKnownLocation(),
    isWatchingLocation: () => locationManager.isWatchingLocation(),
    preWarmLocationServices: () => locationManager.preWarmLocationServices(),
  };
};
