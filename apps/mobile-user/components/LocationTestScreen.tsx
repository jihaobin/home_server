import React from 'react';
import { View, Button, Alert, ScrollView, Text, StyleSheet } from 'react-native';
import { useHighAccuracyLocation, CoordinateConverter } from '@/lib/location-utils';

export const LocationTestScreen: React.FC = () => {
  const [testResults, setTestResults] = React.useState<string[]>([]);
  const { getCurrentPosition, startWatching, stopWatching } = useHighAccuracyLocation();

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testBasicLocation = async () => {
    try {
      addTestResult('🔍 开始基础定位测试...');
      const location = await getCurrentPosition({
        accuracy: 6,
        timeout: 10000,
      });

      addTestResult(`✅ 定位成功！精度: ±${location.accuracy?.toFixed(1)}m`);
      addTestResult(`📍 WGS84: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      addTestResult(`🌍 GCJ02: ${location.gcj02?.latitude.toFixed(6)}, ${location.gcj02?.longitude.toFixed(6)}`);
      addTestResult(`🗺️ BD09: ${location.bd09?.latitude.toFixed(6)}, ${location.bd09?.longitude.toFixed(6)}`);

    } catch (error) {
      addTestResult(`❌ 定位失败: ${error}`);
    }
  };

  const testCoordinateConversion = () => {
    try {
      addTestResult('🔄 测试坐标转换...');

      // 使用北京天安门的坐标进行测试
      const wgs84 = [116.397390, 39.909198]; // 天安门WGS84坐标

      addTestResult('📊 正在进行坐标转换...');

      // 使用本地gcoord库进行同步坐标转换
      const gcj02 = CoordinateConverter.wgs84ToGcj02(wgs84[0], wgs84[1]);
      const bd09 = CoordinateConverter.wgs84ToBd09(wgs84[0], wgs84[1]);
      const backToWgs84 = CoordinateConverter.gcj02ToWgs84(gcj02[0], gcj02[1]);

      addTestResult(`📊 坐标转换测试 (天安门):`);
      addTestResult(`   WGS84: ${wgs84[0].toFixed(6)}, ${wgs84[1].toFixed(6)}`);
      addTestResult(`   GCJ02: ${gcj02[0].toFixed(6)}, ${gcj02[1].toFixed(6)}`);
      addTestResult(`   BD09:  ${bd09[0].toFixed(6)}, ${bd09[1].toFixed(6)}`);
      addTestResult(`   回转:  ${backToWgs84[0].toFixed(6)}, ${backToWgs84[1].toFixed(6)}`);

      // 计算误差
      const error = Math.sqrt(
        Math.pow(wgs84[0] - backToWgs84[0], 2) +
        Math.pow(wgs84[1] - backToWgs84[1], 2)
      );
      addTestResult(`   误差:  ${(error * 111000).toFixed(2)}米`);

      if (error < 0.0001) {
        addTestResult('✅ 坐标转换精度测试通过');
      } else {
        addTestResult('⚠️ 坐标转换可能存在精度问题');
      }
    } catch (error) {
      addTestResult(`❌ 坐标转换测试失败: ${error}`);
    }
  };

  const testContinuousTracking = () => {
    addTestResult('📡 开始连续定位测试 (10秒)...');
    let count = 0;

    startWatching((location) => {
      count++;
      addTestResult(`📍 第${count}次更新: 精度±${location.accuracy?.toFixed(1)}m`);
    }, {
      accuracy: 6,
      timeInterval: 2000,
      distanceInterval: 1,
    });

    // 10秒后停止
    setTimeout(() => {
      stopWatching();
      addTestResult(`✅ 连续定位测试完成，共更新${count}次`);
    }, 10000);
  };

  const testAccuracyLevels = async () => {
    addTestResult('🎯 测试不同精度级别...');

    const accuracyLevels = [
      { level: 1, name: '最低精度' },
      { level: 3, name: '平衡精度' },
      { level: 6, name: '导航精度' },
    ];

    for (const { level, name } of accuracyLevels) {
      try {
        addTestResult(`🔍 测试${name}...`);
        const start = Date.now();

        const location = await getCurrentPosition({
          accuracy: level,
          timeout: 8000,
        });

        const duration = Date.now() - start;
        addTestResult(`   ${name}: ${duration}ms, ±${location.accuracy?.toFixed(1)}m`);

      } catch (error) {
        addTestResult(`   ${name}: 失败 - ${error}`);
      }
    }

    addTestResult('✅ 精度级别测试完成');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runAllTests = async () => {
    clearResults();
    addTestResult('🚀 开始完整测试套件...');

    await testBasicLocation();
    await new Promise(resolve => setTimeout(resolve, 1000));

    testCoordinateConversion(); // 现在是同步的
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testAccuracyLevels();
    await new Promise(resolve => setTimeout(resolve, 1000));

    addTestResult('🎉 所有测试完成！');
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="基础定位测试" onPress={testBasicLocation} color="#2196F3" />
        <Button title="坐标转换测试" onPress={() => testCoordinateConversion()} color="#4CAF50" />
        <Button title="连续定位测试" onPress={testContinuousTracking} color="#FF9800" />
        <Button title="精度级别测试" onPress={testAccuracyLevels} color="#9C27B0" />
        <Button title="运行全部测试" onPress={runAllTests} color="#F44336" />
        <Button title="清除结果" onPress={clearResults} color="#607D8B" />
      </View>

      <ScrollView style={styles.resultContainer}>
        <Text style={styles.resultTitle}>测试结果:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 16,
    gap: 8,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  resultText: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
    color: '#666',
    lineHeight: 16,
  },
});
