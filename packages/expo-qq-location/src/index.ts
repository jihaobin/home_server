import ExpoQqLocationModule from './ExpoQqLocationModule';

// 导出类型
export * from './ExpoQqLocation.types';

// 导出模块
export default ExpoQqLocationModule;

// 便捷方法
export function setUserAgreePrivacy(isAgree: boolean): void {
  return ExpoQqLocationModule.setUserAgreePrivacy(isAgree);
}

export function setDeviceID(deviceId: string): void {
  return ExpoQqLocationModule.setDeviceID(deviceId);
}

export function startLocationUpdates(request: import('./ExpoQqLocation.types').LocationRequest = {}): Promise<number> {
  return ExpoQqLocationModule.startLocationUpdates(request);
}

export function stopLocationUpdates(): void {
  return ExpoQqLocationModule.stopLocationUpdates();
}

export function hasLocationPermission(): Promise<boolean> {
  return ExpoQqLocationModule.hasLocationPermission();
}

export function requestLocationPermission(): Promise<boolean> {
  return ExpoQqLocationModule.requestLocationPermission();
}

export function getApiKey(): string {
  return ExpoQqLocationModule.getApiKey();
}

// 事件监听便捷方法
export function addLocationListener(
  listener: (event: import('./ExpoQqLocation.types').LocationChangedEvent) => void
) {
  return ExpoQqLocationModule.addListener('onLocationChanged', listener);
}

export function addLocationErrorListener(
  listener: (event: import('./ExpoQqLocation.types').LocationErrorEvent) => void
) {
  return ExpoQqLocationModule.addListener('onLocationError', listener);
}

export function addStatusUpdateListener(
  listener: (event: import('./ExpoQqLocation.types').LocationStatusEvent) => void
) {
  return ExpoQqLocationModule.addListener('onStatusUpdate', listener);
}

export function removeAllLocationListeners() {
  ExpoQqLocationModule.removeAllListeners('onLocationChanged');
  ExpoQqLocationModule.removeAllListeners('onLocationError');
  ExpoQqLocationModule.removeAllListeners('onStatusUpdate');
}
