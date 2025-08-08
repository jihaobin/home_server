"use dom"

/**
 * @desc 地图组件 demo
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { BaseMap } from 'tlbs-map-react';
import {Button} from "@repo/web-ui/components/button"

// 设备检测工具函数
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// 获取适合设备的地图配置
const getDeviceOptimizedMapOptions = (center: any, showControl: boolean) => {
  const isMobile = isMobileDevice();

  return {
    center,
    zoom: isMobile ? 15 : 12, // 移动设备使用更高的缩放级别以减少纹理范围
    maxZoom: isMobile ? 16 : 18, // 移动设备限制更低的最大缩放级别
    minZoom: isMobile ? 10 : 8, // 移动设备设置更高的最小缩放级别
    showControl,
    // 移动设备优化的渲染配置
    renderOptions: {
      preserveDrawingBuffer: true, // 不保留绘图缓冲，节省内存
      // 移动设备关闭一些高消耗特性
      ...(isMobile && {
        // 可以在这里添加更多移动端优化配置
      })
    },
    // 移动设备强制使用2D视图模式减少GPU负载
    viewMode: "3d",
    // 移动设备限制地图功能以减少GPU负载
    draggable: true,
    scrollable: true,
    // pitchable: !isMobile, // 移动设备禁用俯仰
    // rotatable: !isMobile, // 移动设备禁用旋转
    touchZoomable: true,
    doubleClickZoom: true,
  };
};

export default function MapContainer() {
  // 通过 mapRef.current 拿到地图实例，但是需要等待地图加载完成
  const mapRef = useRef<any>(null);
  const [center, setCenter] = useState({ lat: 40.0404, lng: 116.2735 });
  const [showControl, setShowControl] = useState(true);
  const [mapOptions, setMapOptions] = useState(() => getDeviceOptimizedMapOptions(center, showControl));

  // 当center或showControl变化时，更新地图配置
  useEffect(() => {
    setMapOptions(getDeviceOptimizedMapOptions(center, showControl));
  }, [center, showControl]);

  /** 打印地图实例 */
  const printInstance = useCallback(() => {
    console.log('🚀🚀🚀  打印地图实例', mapRef.current);
  }, []);

  /**
   * 地图初始化完成事件处理器
   * @param event
   */
  const onMapInited = useCallback(() => {
    console.log('🚀🚀🚀 地图加载完成', mapRef.current);
    // 检测设备类型并输出优化信息
    if (isMobileDevice()) {
      console.log('🚀🚀🚀 检测到移动设备，已应用优化配置');
    }
  }, []);

  /**
   * 地图点击事件处理器
   * @param event
   */
  const clickHandler = useCallback((event: any) => {
    console.log('🚀🚀🚀 地图点击事件', event);
  }, []);

  return (
    <div className='demo-box' style={{width: '100%', height: '400px'}}>
      <div className='action-box'>
        <Button type="button" onClick={printInstance}>
          打印地图实例
        </Button>
        <Button type="button" onClick={() => setCenter({ lat: 40.0404, lng: 116.2735 })}>
          腾讯北京总部大楼
        </Button>
        <Button type="button" onClick={() => setCenter({ lat: 40.0415, lng: 116.2763 })}>
          北京新浪总部大楼
        </Button>
        <Button type="button" onClick={() => setShowControl(showControl => !showControl)}>
          切换控件显示与隐藏
        </Button>
        <Button type="button" onClick={() => {
          const deviceType = isMobileDevice() ? '移动设备' : '桌面设备';
          const currentOptions = getDeviceOptimizedMapOptions(center, showControl);
          alert(`设备类型: ${deviceType}\n缩放级别: ${currentOptions.zoom}\n视图模式: ${currentOptions.viewMode}\n最大缩放: ${currentOptions.maxZoom}`);
        }}>
          设备信息
        </Button>
      </div>
      <div style={{
        width: '100%',
        height: "100%",
      }}>
        <BaseMap
        ref={mapRef}
        apiKey={process.env.EXPO_PUBLIC_TENCENT_MAP_KEY as string}
        control = {{
          zoom: {
            position: 'topRight',
            className: 'tmap-zoom-control-box',
            numVisible: true,
          },
        }}
        options={mapOptions}
        onClick={clickHandler}
        onMapInited={onMapInited}
      />
      </div>
    </div>
  );
};