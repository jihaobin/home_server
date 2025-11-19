import { Ionicons } from "@expo/vector-icons";
import { useCancelOrder, useOrderCheckin, useOrderDetail } from "@repo/hooks/api/order";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { Suspense, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";

const ORDER_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
    pending_payment: { label: "待支付", color: "#FF9800" },
    paid: { label: "待服务", color: "#FF9800" },
    in_progress: { label: "服务中", color: "#4CAF50" },
    completed: { label: "已完成", color: "#2196F3" },
    cancelled: { label: "已取消", color: "#9E9E9E" },
    refunded: { label: "已退款", color: "#9E9E9E" },
};

const DEFAULT_CANCEL_REASON = "服务人员取消：与客户协商";

const DetailSkeleton = () => (
    <View style={styles.skeletonContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.skeletonText}>加载订单详情...</Text>
    </View>
);

function DetailErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
    return (
        <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>无法加载订单</Text>
            <Text style={styles.errorMessage}>{error.message || "请稍后再试"}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={resetErrorBoundary}>
                <Text style={styles.retryText}>重新加载</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function OrderDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const orderIdParam = params.id;
    const orderId = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam;

    if (!orderId) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>未找到订单</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
                    <Text style={styles.retryText}>返回订单列表</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ErrorBoundary FallbackComponent={DetailErrorFallback}>
            <Suspense fallback={<DetailSkeleton />}>
                <OrderDetailContent orderId={orderId} />
            </Suspense>
        </ErrorBoundary>
    );
}

function OrderDetailContent({ orderId }: { orderId: string }) {
    const router = useRouter();
    const { data: order } = useOrderDetail(orderId);
    const {
        data: checkin,
        isFetching: checkinLoading,
        refetch: refetchCheckin,
    } = useOrderCheckin(orderId);
    const cancelOrder = useCancelOrder();
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancelReason, setCancelReason] = useState(DEFAULT_CANCEL_REASON);
    const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

    const statusMeta = ORDER_STATUS_DISPLAY[order.status] ?? ORDER_STATUS_DISPLAY.cancelled;
    const canCancel = ["paid", "in_progress"].includes(order.status as string);
    const description =
        (order as { note?: string; description?: string }).note ??
        (order as { note?: string; description?: string }).description ??
        "暂无补充说明";

    const openCancelModal = () => {
        setCancelReason(DEFAULT_CANCEL_REASON);
        setCancelReasonError(null);
        setCancelModalVisible(true);
    };

    const closeCancelModal = () => {
        setCancelModalVisible(false);
        setCancelReasonError(null);
    };

    const handleCancelConfirm = async () => {
        const trimmed = cancelReason.trim();
        if (!trimmed) {
            setCancelReasonError("请输入取消原因");
            return;
        }

        try {
            await cancelOrder.mutateAsync({ orderId, reason: trimmed });
            Alert.alert("已取消", "订单已标记为取消");
            closeCancelModal();
            router.back();
        } catch (error) {
            Alert.alert("取消失败", (error as Error)?.message ?? "请稍后再试");
        }
    };
    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.orderHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.orderService}>{order.service?.name ?? "未知服务"}</Text>
                            <Text style={styles.orderSerial}>订单号：{order.orderSerial}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusMeta.color }]}>
                            <Text style={styles.statusText}>{statusMeta.label}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={18} color="#666" />
                        <Text style={styles.infoValue}>
                            {formatDateTime(order.appointmentTime) ?? "未排期"}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="pricetag-outline" size={18} color="#666" />
                        <Text style={styles.infoValue}>{formatCurrency(order.totalAmount)}</Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>服务地址</Text>
                    <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={18} color="#666" />
                        <Text style={styles.infoValue}>
                            {order.address?.detailedAddress ?? "暂未填写"}
                        </Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>客户信息</Text>
                    <View style={styles.infoRow}>
                        <Ionicons name="person-outline" size={18} color="#666" />
                        <Text style={styles.infoValue}>{order.customerId}</Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>备注 & 要求</Text>
                    <Text style={styles.descText}>{description}</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.qrHeader}>
                        <Text style={styles.cardTitle}>核验二维码</Text>
                        <TouchableOpacity onPress={() => refetchCheckin()}>
                            <Text style={styles.linkText}>刷新</Text>
                        </TouchableOpacity>
                    </View>
                    {checkinLoading ? (
                        <ActivityIndicator color="#2196F3" />
                    ) : (
                        <>
                            <Text style={styles.qrText}>
                                有效期至：{formatDateTime(checkin?.expiresAt) ?? "获取失败"}
                            </Text>
                            {checkin?.token ? (
                                <Text style={styles.monoText}>{checkin.token}</Text>
                            ) : (
                                <Text style={styles.descText}>获取二维码失败，请刷新后重试</Text>
                            )}
                            <TouchableOpacity
                                style={styles.scanButton}
                                onPress={() => {
                                    router.push("/scan" as never);
                                }}
                            >
                                <Text style={styles.scanButtonText}>前往扫码核验</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>

            {canCancel && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={openCancelModal}
                        disabled={cancelOrder.isPending}
                    >
                        <Text style={styles.cancelText}>
                            {cancelOrder.isPending ? "取消中..." : "取消订单"}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <Modal
                visible={cancelModalVisible}
                animationType="slide"
                transparent
                onRequestClose={closeCancelModal}
            >
                <View style={styles.modalBackdrop}>
                    <KeyboardAvoidingView
                        style={styles.modalWrapper}
                        behavior={Platform.select({ ios: "padding", android: undefined })}
                    >
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>填写取消原因</Text>
                            <Text style={styles.modalSubtitle}>该原因会同步给客服与用户，便于后续跟进。</Text>
                            <TextInput
                                style={[
                                    styles.reasonInput,
                                    cancelReasonError ? styles.inputError : null,
                                ]}
                                value={cancelReason}
                                onChangeText={(value) => {
                                    setCancelReason(value);
                                    if (cancelReasonError && value.trim()) {
                                        setCancelReasonError(null);
                                    }
                                }}
                                placeholder="例如：客户临时改期或地址无法到达"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                editable={!cancelOrder.isPending}
                            />
                            {cancelReasonError ? (
                                <Text style={styles.inputErrorText}>{cancelReasonError}</Text>
                            ) : null}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalCancelButton]}
                                    onPress={closeCancelModal}
                                    disabled={cancelOrder.isPending}
                                >
                                    <Text style={styles.modalCancelText}>返回</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.modalConfirmButton,
                                        cancelOrder.isPending && styles.modalButtonDisabled,
                                    ]}
                                    onPress={handleCancelConfirm}
                                    disabled={cancelOrder.isPending}
                                >
                                    {cancelOrder.isPending ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalConfirmText}>确认取消</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

function formatDateTime(value?: string | Date | null) {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, "0");
    const dd = `${date.getDate()}`.padStart(2, "0");
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mi = `${date.getMinutes()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatCurrency(value?: number | string | null) {
    const amount = typeof value === "string" ? Number(value) : value ?? 0;
    return `¥${amount.toFixed(2)}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    orderService: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
    },
    orderSerial: {
        marginTop: 4,
        fontSize: 12,
        color: "#999",
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: "white",
        fontWeight: "bold",
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    infoValue: {
        marginLeft: 8,
        fontSize: 14,
        color: "#555",
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 8,
    },
    descText: {
        fontSize: 14,
        color: "#666",
        lineHeight: 20,
    },
    qrHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    linkText: {
        color: "#2196F3",
        fontSize: 14,
    },
    qrText: {
        fontSize: 13,
        color: "#555",
        marginBottom: 6,
    },
    monoText: {
        fontFamily: "Menlo",
        fontSize: 13,
        color: "#333",
        backgroundColor: "#F4F4F4",
        padding: 8,
        borderRadius: 8,
    },
    scanButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#2196F3",
        alignItems: "center",
    },
    scanButtonText: {
        color: "white",
        fontWeight: "bold",
    },
    footer: {
        flexDirection: "row",
        padding: 16,
        backgroundColor: "white",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#eee",
    },
    actionButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: 4,
    },
    cancelButton: {
        borderWidth: 1,
        borderColor: "#FF7043",
        backgroundColor: "white",
    },
    completeButton: {
        backgroundColor: "#4CAF50",
    },
    cancelText: {
        color: "#FF7043",
        fontWeight: "bold",
    },
    completeText: {
        color: "white",
        fontWeight: "bold",
    },
    skeletonContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    skeletonText: {
        marginTop: 12,
        color: "#666",
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#d32f2f",
    },
    errorMessage: {
        marginTop: 8,
        color: "#666",
        textAlign: "center",
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: "#2196F3",
    },
    retryText: {
        color: "white",
        fontWeight: "bold",
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 24,
    },
    modalWrapper: {
        flex: 1,
        justifyContent: "center",
    },
    modalCard: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
        marginBottom: 12,
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 12,
        minHeight: 100,
        fontSize: 15,
        color: "#333",
        backgroundColor: "#fafafa",
    },
    inputError: {
        borderColor: "#d32f2f",
    },
    inputErrorText: {
        color: "#d32f2f",
        fontSize: 13,
        marginTop: 6,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 20,
        gap: 12,
    },
    modalButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 999,
    },
    modalCancelButton: {
        borderWidth: 1,
        borderColor: "#ccc",
        backgroundColor: "white",
    },
    modalConfirmButton: {
        backgroundColor: "#d32f2f",
    },
    modalButtonDisabled: {
        opacity: 0.6,
    },
    modalCancelText: {
        color: "#666",
        fontWeight: "bold",
    },
    modalConfirmText: {
        color: "white",
        fontWeight: "bold",
    },
});
