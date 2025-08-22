import { NativeModule, requireNativeModule } from 'expo';

import { ExpoQqLocationModuleEvents, LocationRequest } from './ExpoQqLocation.types';

declare class ExpoQqLocationModule extends NativeModule<ExpoQqLocationModuleEvents> {
    // 设置用户是否同意隐私协议
    setUserAgreePrivacy: (isAgree: boolean) => void;

    // 设置设备唯一标识
    setDeviceID: (deviceId: string) => void;

    // 开始连续定位
    startLocationUpdates: (request: LocationRequest) => Promise<number>;

    // 停止定位
    stopLocationUpdates: () => void;

    // 检查定位权限
    hasLocationPermission: () => Promise<boolean>;

    // 请求定位权限
    requestLocationPermission: () => Promise<boolean>;

    // 获取API Key（用于测试config plugin是否工作）
    getApiKey: () => string;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoQqLocationModule>('ExpoQqLocation');
