import * as Location from "expo-location";
import {
	addLocationErrorListener,
	addLocationListener,
	addStatusUpdateListener,
	getApiKey,
	type LocationChangedEvent,
	type LocationErrorEvent,
	LocationMode,
	type LocationRequest,
	type LocationStatusEvent,
	RequestLevel,
	removeAllLocationListeners,
	setDeviceID,
	setUserAgreePrivacy,
	startLocationUpdates,
	stopLocationUpdates,
} from "expo-qq-location";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { Platform } from "react-native";
import { toast } from "sonner-native";

/**
 * 请求位置权限
 */
async function requestPermissions(): Promise<boolean> {
	try {
		// 请求前台权限
		const { status: foregroundStatus } =
			await Location.requestForegroundPermissionsAsync();

		if (foregroundStatus !== "granted") {
			console.warn("前台位置权限被拒绝");
			return false;
		}

		// 如果是Android，尝试请求后台权限以获得更好的定位
		if (Platform.OS === "android") {
			try {
				const { status: backgroundStatus } =
					await Location.requestBackgroundPermissionsAsync();
				if (backgroundStatus === "granted") {
				}
			} catch (error) {
				console.log("后台权限请求失败，但前台权限足够基本使用");
			}
		}

		// 启用网络定位提供程序
		try {
			await Location.enableNetworkProviderAsync();
		} catch (error) {
			console.log("网络定位提供程序启用失败，但不影响基本功能");
		}

		return true;
	} catch (error) {
		console.error("请求位置权限失败:", error);
		return false;
	}
}

let cacheLocation: LocationChangedEvent | null = null;

interface LocationState {
	location: LocationChangedEvent | null;
	isLocating: boolean;
	locationStatus: string;
	error: string | null;
	apiKey: string;
}

type LocationAction =
	| { type: "SET_LOCATION"; payload: LocationChangedEvent | null }
	| { type: "SET_IS_LOCATING"; payload: boolean }
	| { type: "SET_LOCATION_STATUS"; payload: string }
	| { type: "SET_ERROR"; payload: string | null }
	| { type: "SET_API_KEY"; payload: string }
	| { type: "RESET_STATE" };

function locationReducer(
	state: LocationState,
	action: LocationAction,
): LocationState {
	switch (action.type) {
		case "SET_LOCATION":
			return { ...state, location: action.payload };
		case "SET_IS_LOCATING":
			return { ...state, isLocating: action.payload };
		case "SET_LOCATION_STATUS":
			return { ...state, locationStatus: action.payload };
		case "SET_ERROR":
			return { ...state, error: action.payload };
		case "SET_API_KEY":
			return { ...state, apiKey: action.payload };
		case "RESET_STATE":
			return {
				location: null,
				isLocating: false,
				locationStatus: "未开始定位",
				error: null,
				apiKey: "",
			};
		default:
			return state;
	}
}

const initialState: LocationState = {
	location: null,
	isLocating: false,
	locationStatus: "未开始定位",
	error: null,
	apiKey: "",
};

export default function useLocation(
	options = {
		interval: 10 * 1000, // 10秒间隔
		requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
		allowGPS: true,
		allowDirection: true,
		indoorLocationMode: true,
		locMode: LocationMode.HIGH_ACCURACY_MODE,
		gpsFirst: false,
		gpsTimeOut: 8000,
	} as LocationRequest & {
		onSuccess?: (event: LocationChangedEvent) => void;
		onError?: (event: LocationErrorEvent) => void;
		onUpdate?: (event: LocationStatusEvent) => void;
	},
) {
	const [state, dispatch] = useReducer(locationReducer, initialState);

	// 使用 ref 来避免闭包问题
	const isInitializedRef = useRef(false);
	const listenersRef = useRef<{
		location?: any;
		error?: any;
		status?: any;
	}>({});
	const lastLocationRef = useRef<LocationChangedEvent | null>(null);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isMountedRef = useRef(true);

	// 使用 ref 来保存最新的 options 和回调
	const optionsRef = useRef(options);
	optionsRef.current = options;

	const callbacksRef = useRef({
		onSuccess: options.onSuccess,
		onError: options.onError,
		onUpdate: options.onUpdate,
	});
	callbacksRef.current = {
		onSuccess: options.onSuccess,
		onError: options.onError,
		onUpdate: options.onUpdate,
	};

	// 防抖更新位置信息
	const debouncedUpdateLocation = useCallback((event: LocationChangedEvent) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		debounceTimerRef.current = setTimeout(() => {
			// 检查位置是否有显著变化
			const lastLocation = lastLocationRef.current;
			if (lastLocation) {
				const latDiff = Math.abs(event.latitude - lastLocation.latitude);
				const lngDiff = Math.abs(event.longitude - lastLocation.longitude);

				// 如果位置变化很小（小于10米），则不更新状态
				if (latDiff < 0.001 && lngDiff < 0.001) {
					callbacksRef.current.onSuccess?.(event);
					return;
				}
			}

			cacheLocation = event;
			lastLocationRef.current = event;

			if (isMountedRef.current) {
				dispatch({ type: "SET_LOCATION", payload: event });
				dispatch({ type: "SET_ERROR", payload: null });

				// 只在首次定位成功时更新状态文本
				dispatch({ type: "SET_LOCATION_STATUS", payload: "定位成功" });
			}

			callbacksRef.current.onSuccess?.(event);
		}, 500); // 500ms 防抖
	}, []);

	// 优化错误处理
	const handleLocationError = useCallback((event: LocationErrorEvent) => {
		const errorMessage = `定位错误: ${event.reason || JSON.stringify(event)}`;

		if (isMountedRef.current) {
			dispatch({ type: "SET_ERROR", payload: errorMessage });
			dispatch({ type: "SET_LOCATION_STATUS", payload: "定位失败" });
			dispatch({ type: "SET_IS_LOCATING", payload: false });
		}

		callbacksRef.current.onError?.(event);
	}, []);

	// 优化状态更新处理
	const handleStatusUpdate = useCallback((event: LocationStatusEvent) => {
		const statusText = `状态更新: ${JSON.stringify(event)}`;

		if (isMountedRef.current) {
			dispatch({ type: "SET_LOCATION_STATUS", payload: statusText });
		}

		callbacksRef.current.onUpdate?.(event);
	}, []);

	const handleStartContinuousLocation = useCallback(async () => {
		if (isInitializedRef.current) {
			console.log("定位服务已经启动，跳过重复初始化");
			return;
		}

		try {
			// 清除之前的错误状态
			dispatch({ type: "SET_ERROR", payload: null });
			dispatch({ type: "SET_LOCATION_STATUS", payload: "检查权限中..." });

			// 尝试请求权限
			const permissionGranted = await requestPermissions();
			if (!permissionGranted) {
				const errorMsg = "请在设置中授予定位权限";

				if (isMountedRef.current) {
					dispatch({ type: "SET_ERROR", payload: errorMsg });
					dispatch({ type: "SET_LOCATION_STATUS", payload: "权限被拒绝" });
				}

				toast.error(errorMsg);
				return;
			}

			dispatch({ type: "SET_LOCATION_STATUS", payload: "启动定位中..." });
			dispatch({ type: "SET_IS_LOCATING", payload: true });

			// 开始连续定位
			const result = await startLocationUpdates(optionsRef.current);

			if (result === 0) {
				if (isMountedRef.current) {
					dispatch({ type: "SET_LOCATION_STATUS", payload: "定位已启动" });
				}
				isInitializedRef.current = true;
			} else {
				const errorMsg = `启动定位失败，错误码: ${result}`;

				if (isMountedRef.current) {
					dispatch({ type: "SET_IS_LOCATING", payload: false });
					dispatch({ type: "SET_ERROR", payload: errorMsg });
					dispatch({ type: "SET_LOCATION_STATUS", payload: "启动失败" });
				}

				toast.error("启动定位失败");
			}
		} catch (error) {
			const errorMsg = `启动定位异常: ${error instanceof Error ? error.message : "未知错误"}`;

			if (isMountedRef.current) {
				dispatch({ type: "SET_IS_LOCATING", payload: false });
				dispatch({ type: "SET_ERROR", payload: errorMsg });
				dispatch({ type: "SET_LOCATION_STATUS", payload: "启动异常" });
			}

			toast.error("启动定位失败");
		}
	}, []);

	useEffect(() => {
		isMountedRef.current = true;

		// 避免重复初始化
		if (isInitializedRef.current) {
			return;
		}

		// 设置用户同意隐私协议（必须）
		setUserAgreePrivacy(true);

		// 获取API Key - 只获取一次
		const key = getApiKey();
		dispatch({ type: "SET_API_KEY", payload: key });

		// 设置设备ID（可选）
		setDeviceID("unLoginUser");

		// 添加定位成功监听器
		const locationSubscription = addLocationListener(debouncedUpdateLocation);
		listenersRef.current.location = locationSubscription;

		// 添加定位错误监听器
		const errorSubscription = addLocationErrorListener(handleLocationError);
		listenersRef.current.error = errorSubscription;

		// 添加状态监听器
		const statusSubscription = addStatusUpdateListener(handleStatusUpdate);
		listenersRef.current.status = statusSubscription;

		// 延迟启动定位，确保监听器已经完全设置
		const timeoutId = setTimeout(() => {
			handleStartContinuousLocation();
		}, 100);

		return () => {
			isMountedRef.current = false;

			// 清理定时器
			clearTimeout(timeoutId);

			// 清理防抖定时器
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}

			// 清理监听器
			if (listenersRef.current.location) {
				listenersRef.current.location.remove();
			}
			if (listenersRef.current.error) {
				listenersRef.current.error.remove();
			}
			if (listenersRef.current.status) {
				listenersRef.current.status.remove();
			}

			// 停止定位
			if (isInitializedRef.current) {
				stopLocationUpdates();
				removeAllLocationListeners();
				isInitializedRef.current = false;
			}
		};
	}, [
		debouncedUpdateLocation,
		handleLocationError,
		handleStatusUpdate,
		handleStartContinuousLocation,
	]);

	const handleStopLocation = useCallback(() => {
		try {
			dispatch({ type: "SET_IS_LOCATING", payload: false });
			dispatch({ type: "SET_LOCATION_STATUS", payload: "定位已停止" });
			dispatch({ type: "SET_ERROR", payload: null }); // 清除错误状态

			// 清理防抖定时器
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}

			// 停止定位
			if (isInitializedRef.current) {
				stopLocationUpdates();
				removeAllLocationListeners();
				isInitializedRef.current = false;
			}
		} catch (error) {
			const errorMsg = `停止定位失败: ${error instanceof Error ? error.message : "未知错误"}`;

			if (isMountedRef.current) {
				dispatch({ type: "SET_ERROR", payload: errorMsg });
				dispatch({ type: "SET_LOCATION_STATUS", payload: "停止失败" });
			}

			toast.error("停止定位失败");
		}
	}, []);

	return {
		location: state.location || cacheLocation,
		isLocating: state.isLocating,
		locationStatus: state.locationStatus,
		error: state.error,
		apiKey: state.apiKey,
		handleStopLocation,
	};
}
