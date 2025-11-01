import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { OrderCheckinPayload } from "@repo/types";
import { useVerifyCheckIn } from "@repo/hooks/api/order";
import useLocation from "@repo/hooks/useLocation";
import { Button } from "@/src/components/ui/button";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ExploreScreen() {
  const params = useLocalSearchParams<{
    qrData?: string | string[];
    orderId?: string | string[];
    token?: string | string[];
  }>();

  const extractParam = useCallback((value?: string | string[]) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }, []);

  const { payload, rawText, parseError } = useMemo(() => {
    const qrRaw = extractParam(params.qrData);
    const presetOrderId = extractParam(params.orderId);
    const presetToken = extractParam(params.token);

    if (presetOrderId && presetToken) {
      return {
        payload: { orderId: presetOrderId, token: presetToken },
        rawText: qrRaw ?? JSON.stringify({ orderId: presetOrderId, token: presetToken }),
        parseError: null,
      } satisfies {
        payload: OrderCheckinPayload | null;
        rawText: string | null;
        parseError: string | null;
      };
    }

    if (!qrRaw) {
      return { payload: null, rawText: null, parseError: null };
    }

    try {
      const parsed = JSON.parse(qrRaw) as Partial<OrderCheckinPayload>;
      if (parsed?.orderId && parsed?.token) {
        return { payload: parsed as OrderCheckinPayload, rawText: qrRaw, parseError: null };
      }
      return {
        payload: null,
        rawText: qrRaw,
        parseError: "二维码数据缺少必要字段",
      };
    } catch (error) {
      return {
        payload: null,
        rawText: qrRaw,
        parseError: "二维码数据格式无法解析为 JSON",
      };
    }
  }, [extractParam, params]);

  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");

  const verifyMutation = useVerifyCheckIn();
  const isVerifying = verifyMutation.isPending;
  const { location, isLocating, locationStatus, error: locationError } = useLocation();

  useEffect(() => {
    if (location) {
      setLastCoords({ latitude: location.latitude, longitude: location.longitude });
    }
  }, [location]);

  const handleCopy = useCallback(async () => {
    const content = payload ? JSON.stringify(payload) : rawText;
    if (!content) {
      Alert.alert("无法复制", "当前没有可复制的数据");
      return;
    }

    try {
      await Clipboard.setStringAsync(content);
      Alert.alert("已复制", "数据已复制到剪贴板");
    } catch (error) {
      Alert.alert("复制失败", error instanceof Error ? error.message : "未知错误");
    }
  }, [payload, rawText]);

  const handleVerify = useCallback(async () => {
    if (!payload) {
      setVerificationStatus("error");
      setVerificationMessage("缺少可核验的二维码数据");
      Alert.alert("无法核验", "请重新扫描二维码后再试");
      return;
    }

    setVerificationMessage(null);
    setVerificationStatus("idle");

    try {
      const coords = lastCoords;
      if (!coords) {
        const message = locationError || (isLocating ? "正在获取定位，请稍后再试" : "未能获取定位信息");
        setVerificationStatus("error");
        setVerificationMessage(message);
        Alert.alert("定位未就绪", message);
        return;
      }

      const response = await verifyMutation.mutateAsync({
        orderId: payload.orderId,
        token: payload.token,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      setVerificationStatus("success");
      const successMessage = response?.message || "核验成功";
      setVerificationMessage(successMessage);
      Alert.alert("核验成功", successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setVerificationStatus("error");
      setVerificationMessage(message);
      Alert.alert("核验失败", message);
    }
  }, [payload, verifyMutation, lastCoords, isLocating, locationError]);

  return (
    <ScrollView style={styles.container}>
        <SafeAreaView >
        <Link href={"/auth/login"}>登录</Link>
      <View style={styles.content}>
        <Ionicons name="qr-code" size={64} color="#2e78b7" style={styles.icon} />
        <Text style={styles.title}>二维码扫描结果</Text>

        {payload || rawText ? (
          <View style={styles.resultContainer}>
            {payload ? (
              <View style={styles.detailBlock}>
                <Text style={styles.resultLabel}>订单信息</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>订单 ID：</Text>
                  <Text style={styles.fieldValue}>{payload.orderId}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>核验令牌：</Text>
                  <Text style={styles.fieldValue}>{payload.token}</Text>
                </View>
              </View>
            ) : null}

            {parseError ? (
              <Text style={styles.errorText}>{parseError}</Text>
            ) : null}

            {rawText ? (
              <View style={styles.detailBlock}>
                <Text style={styles.resultLabel}>原始数据</Text>
                <Text style={styles.resultData} selectable>
                  {rawText}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
              <Text style={styles.copyButtonText}>复制数据</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.verifyButton, (!lastCoords || isVerifying) && styles.verifyButtonDisabled]}
              onPress={handleVerify}
              disabled={isVerifying || !lastCoords}
            >
              <Text style={styles.verifyButtonText}>
                {isVerifying ? "核验中..." : lastCoords ? "核验到场" : "等待定位..."}
              </Text>
            </TouchableOpacity>
            {isVerifying && (
              <ActivityIndicator style={styles.statusIndicator} size="small" color="#2e78b7" />
            )}
            {lastCoords ? (
              <Text style={styles.statusText}>
                最近定位：{lastCoords.latitude.toFixed(6)}, {lastCoords.longitude.toFixed(6)}
              </Text>
            ) : null}
            {locationStatus ? (
              <Text style={styles.statusText}>定位状态：{locationStatus}</Text>
            ) : null}
            {locationError ? (
              <Text style={[styles.statusText, styles.statusTextError]}>定位失败：{locationError}</Text>
            ) : null}
            {verificationMessage ? (
              <Text
                style={[
                  styles.statusText,
                  verificationStatus === "success" ? styles.statusTextSuccess : styles.statusTextError,
                ]}
              >
                {verificationMessage}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>未接收到二维码数据</Text>
            <Text style={styles.hintText}>请返回扫描页面重新扫描二维码</Text>
          </View>
        )}
      </View>
        </SafeAreaView >
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
  detailBlock: {
    width: '100%',
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 6,
  },
  fieldValue: {
    fontSize: 16,
    color: '#555',
    flexShrink: 1,
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
    marginBottom: 12,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#2e78b7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#92b7d4',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    marginTop: 12,
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
    alignSelf: 'flex-start',
  },
  statusTextSuccess: {
    color: '#2e7d32',
  },
  statusTextError: {
    color: '#d9534f',
  },
  errorText: {
    color: '#d9534f',
    fontSize: 14,
    marginBottom: 12,
    alignSelf: 'flex-start',
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