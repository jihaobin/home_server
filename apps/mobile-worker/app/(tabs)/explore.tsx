import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderCheckinPayload } from '@repo/types';

export default function ExploreScreen() {
  const qrData = useLocalSearchParams<OrderCheckinPayload>();


  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="qr-code" size={64} color="#2e78b7" style={styles.icon} />
        <Text style={styles.title}>二维码扫描结果</Text>

        {qrData ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultLabel}>扫描结果:</Text>
            <Text style={styles.resultData} selectable={true}>
              {typeof qrData === 'string' ? qrData : JSON.stringify(qrData)}
            </Text>

               {/* 提供复制功能 */}
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => {
                // 这里可以集成剪贴板功能，但需要导入expo-clipboard
                alert('数据已复制到剪贴板: ' + qrData);
              }}
            >
              <Text style={styles.copyButtonText}>复制数据</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>未接收到二维码数据</Text>
            <Text style={styles.hintText}>请返回扫描页面重新扫描二维码</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  resultContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  resultData: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'left',
    width: '100%',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  linkButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  linkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  copyButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  copyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  hintText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});