// 定位结果事件
export type LocationChangedEvent = {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
    bearing: number;
    speed: number;
    timestamp: number;
    // 地址信息（当requestLevel包含地址时）
    nation?: string;
    province?: string;
    city?: string;
    district?: string;
    town?: string;
    village?: string;
    street?: string;
    streetNo?: string;
    name?: string;
    address?: string;
    // POI信息（当requestLevel为POI时）
    poiList?: Array<{
        name: string;
        address: string;
        latitude: number;
        longitude: number;
    }>;
};

// 定位状态事件
export type LocationStatusEvent = {
    name: string; // GPS, WIFI, CELL
    status: number; // 状态码
    desc: string; // 状态描述
};

// 定位错误事件
export type LocationErrorEvent = {
    error: number;
    reason: string;
};

export type ExpoQqLocationModuleEvents = {
    onLocationChanged: (event: LocationChangedEvent) => void;
    onLocationError: (event: LocationErrorEvent) => void;
    onStatusUpdate: (event: LocationStatusEvent) => void;
};

// 定位请求配置
export type LocationRequest = {
    // 定位间隔（毫秒），最小1000ms
    interval?: number;
    // 请求级别：0-仅坐标, 1-坐标+地址, 3-坐标+行政区划, 4-坐标+行政区划+POI
    requestLevel?: number;
    // 是否允许GPS
    allowGPS?: boolean;
    // 是否获取传感器方向
    allowDirection?: boolean;
    // 是否开启室内定位
    indoorLocationMode?: boolean;
    // 定位模式：0-高精度, 1-仅网络, 2-仅GPS
    locMode?: number;
    // GPS优先
    gpsFirst?: boolean;
    // GPS超时时间（毫秒）
    gpsTimeOut?: number;
};

// 错误码常量
export const ErrorCodes = {
    ERROR_OK: 0,
    ERROR_NETWORK: 1,
    ERROR_BAD_JSON: 2,
    ERROR_WGS84: 4,
    ERROR_UNKNOWN: 404,
} as const;

// 状态码常量
export const StatusCodes = {
    STATUS_DISABLED: 0,
    STATUS_ENABLED: 1,
    STATUS_DENIED: 2,
    STATUS_GPS_AVAILABLE: 3,
    STATUS_GPS_UNAVAILABLE: 4,
    STATUS_LOCATION_SWITCH_OFF: 5,
} as const;

// 请求级别常量
export const RequestLevel = {
    REQUEST_LEVEL_GEO: 0,
    REQUEST_LEVEL_NAME: 1,
    REQUEST_LEVEL_ADMIN_AREA: 3,
    REQUEST_LEVEL_POI: 4,
} as const;

// 定位模式常量
export const LocationMode = {
    HIGH_ACCURACY_MODE: 10,
    ONLY_NETWORK_MODE: 11,
    ONLY_GPS_MODE: 12,
} as const;
