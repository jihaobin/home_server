import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Text, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';
import { EnhancedLocationData, useHighAccuracyLocation } from '@/lib/location-utils';

interface TencentMapProps {
  onLocationSelect?: (data: any) => void;
  onLocationUpdate?: (location: EnhancedLocationData) => void;
  showCurrentLocation?: boolean;
  enableLocationPicker?: boolean;
  apiKey?: string;
  style?: any;
}

const TencentMap: React.FC<TencentMapProps> = ({
  onLocationSelect,
  onLocationUpdate,
  showCurrentLocation = true,
  enableLocationPicker = true,
  apiKey = 'KEGBZ-HGBW3-UYS3G-RMZ73-WVRTO-DLF6L', // 你的腾讯地图API Key
  style,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [currentLocation, setCurrentLocation] = useState<EnhancedLocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const { getCurrentPosition, startWatching, stopWatching } = useHighAccuracyLocation();

  useEffect(() => {
    if (showCurrentLocation) {
      initializeLocation();
    }

    return () => {
      stopWatching();
    };
  }, [showCurrentLocation]);

  const initializeLocation = async () => {
    try {
      setIsLoading(true);

      // 获取当前高精度位置
      const location = await getCurrentPosition({
        accuracy: 6, // BestForNavigation
        timeout: 15000,
        maximumAge: 10000,
      });

      setCurrentLocation(location);
      onLocationUpdate?.(location);

      // 如果地图已准备好，更新地图位置
      if (mapReady && location.gcj02) {
        updateMapLocation(location.gcj02.latitude, location.gcj02.longitude);
      }

    } catch (error) {
      console.error('获取位置失败:', error);
      Alert.alert('定位失败', '无法获取当前位置，请检查位置权限设置');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMapLocation = (latitude: number, longitude: number) => {
    if (webViewRef.current) {
      const script = `
        if (typeof updateCurrentLocation === 'function') {
          updateCurrentLocation(${latitude}, ${longitude});
        }
      `;
      webViewRef.current.injectJavaScript(script);
    }
  };

  const startLocationTracking = () => {
    startWatching((location) => {
      setCurrentLocation(location);
      onLocationUpdate?.(location);

      if (mapReady && location.gcj02) {
        updateMapLocation(location.gcj02.latitude, location.gcj02.longitude);
      }
    }, {
      accuracy: 6,
      timeInterval: 2000,
      distanceInterval: 5,
    });
  };

  const generateMapHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>腾讯地图</title>
    <script charset="utf-8" src="https://map.qq.com/api/gljs?v=1.exp&key=${apiKey}"></script>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: 'Microsoft YaHei', sans-serif;
        }
        #mapContainer {
            width: 100%;
            height: 100vh;
            position: relative;
        }
        .location-info {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-size: 12px;
            z-index: 1000;
            max-width: 200px;
        }
        .accuracy-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .high-accuracy { background-color: #4CAF50; }
        .medium-accuracy { background-color: #FF9800; }
        .low-accuracy { background-color: #F44336; }
    </style>
</head>
<body>
    <div id="mapContainer">
        <div id="locationInfo" class="location-info" style="display: none;">
            <div id="accuracyStatus"></div>
            <div id="coordinates"></div>
        </div>
    </div>

    <script>
        let map;
        let currentLocationMarker;
        let locationCircle;

        // 初始化地图
        function initMap() {
            map = new TMap.Map('mapContainer', {
                center: new TMap.LatLng(39.908823, 116.397502), // 默认北京
                zoom: 16,
                baseMap: {
                    type: 'vector'
                }
            });

            // 地图点击事件
            map.on('click', function(evt) {
                const lat = evt.latLng.getLat();
                const lng = evt.latLng.getLng();

                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapClick',
                    latitude: lat,
                    longitude: lng,
                    address: '点击位置'
                }));
            });

            console.log('地图初始化完成');

            // 通知React Native地图已准备好
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapReady'
            }));
        }

        // 更新当前位置
        function updateCurrentLocation(lat, lng, accuracy) {
            if (!map) return;

            const center = new TMap.LatLng(lat, lng);

            // 更新地图中心
            map.setCenter(center);

            // 移除旧的位置标记
            if (currentLocationMarker) {
                currentLocationMarker.setMap(null);
            }
            if (locationCircle) {
                locationCircle.setMap(null);
            }

            // 添加当前位置标记
            currentLocationMarker = new TMap.MultiMarker({
                map: map,
                styles: {
                    'current-location': new TMap.MarkerStyle({
                        width: 20,
                        height: 30,
                        anchor: { x: 10, y: 30 },
                        src: 'https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/marker.png'
                    })
                },
                geometries: [{
                    id: 'current-position',
                    styleId: 'current-location',
                    position: center
                }]
            });

            // 根据精度显示圆圈
            if (accuracy && accuracy > 0) {
                const radius = Math.max(accuracy, 10); // 最小10米半径

                locationCircle = new TMap.MultiCircle({
                    map: map,
                    styles: {
                        'accuracy-circle': new TMap.CircleStyle({
                            color: 'rgba(54, 162, 235, 0.3)',
                            borderColor: 'rgba(54, 162, 235, 0.8)',
                            borderWidth: 2
                        })
                    },
                    geometries: [{
                        id: 'accuracy-area',
                        styleId: 'accuracy-circle',
                        center: center,
                        radius: radius
                    }]
                });
            }

            // 更新信息显示
            updateLocationInfo(lat, lng, accuracy);
        }

        // 更新位置信息显示
        function updateLocationInfo(lat, lng, accuracy) {
            const infoDiv = document.getElementById('locationInfo');
            const accuracyDiv = document.getElementById('accuracyStatus');
            const coordsDiv = document.getElementById('coordinates');

            if (infoDiv && accuracyDiv && coordsDiv) {
                infoDiv.style.display = 'block';

                // 精度状态
                let accuracyClass = 'low-accuracy';
                let accuracyText = '定位精度：低';

                if (accuracy) {
                    if (accuracy <= 20) {
                        accuracyClass = 'high-accuracy';
                        accuracyText = \`高精度：±\${accuracy.toFixed(1)}m\`;
                    } else if (accuracy <= 100) {
                        accuracyClass = 'medium-accuracy';
                        accuracyText = \`中等精度：±\${accuracy.toFixed(1)}m\`;
                    } else {
                        accuracyText = \`低精度：±\${accuracy.toFixed(1)}m\`;
                    }
                }

                accuracyDiv.innerHTML = \`<span class="accuracy-indicator \${accuracyClass}"></span>\${accuracyText}\`;
                coordsDiv.innerHTML = \`经度：\${lng.toFixed(6)}<br>纬度：\${lat.toFixed(6)}\`;
            }
        }

        // 地图加载完成后初始化
        window.onload = function() {
            initMap();
        };

        // 全局函数，供React Native调用
        window.updateCurrentLocation = updateCurrentLocation;
    </script>
</body>
</html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          setIsLoading(false);

          // 如果已有位置信息，立即更新地图
          if (currentLocation?.gcj02) {
            setTimeout(() => {
              updateMapLocation(currentLocation.gcj02!.latitude, currentLocation.gcj02!.longitude);
            }, 500);
          }
          break;

        case 'mapClick':
          onLocationSelect?.(data);
          break;

        default:
          console.log('未知消息类型:', data);
      }
    } catch (error) {
      console.error('解析WebView消息失败:', error);
    }
  };

  const handleLoadEnd = () => {
    // 注入消息监听器
    if (webViewRef.current) {
      const script = `
        // 确保消息可以传递到React Native
        window.addEventListener('message', function(event) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
          }
        }, false);
      `;
      webViewRef.current.injectJavaScript(script);
    }
  };

  if (showCurrentLocation && isLoading) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>正在获取高精度位置...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onMessage={handleWebViewMessage}
        onLoadEnd={handleLoadEnd}
        style={styles.webview}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.loadingText}>正在加载地图...</Text>
          </View>
        )}
      />

      {currentLocation && (
        <View style={styles.locationBadge}>
          <Text style={styles.locationBadgeText}>
            精度: ±{currentLocation.accuracy?.toFixed(1) || 'N/A'}m
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  locationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(25, 118, 210, 0.9)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default TencentMap;
