import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";

const maskPhone = (value?: string | null) => {
    if (!value) {
        return "当前账号";
    }

    const normalized = value.replace(/\s+/g, "");
    if (normalized.length < 7) {
        return normalized;
    }

    return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
};

export default function AccountCancellationScreen() {
    return (
        <RequireAuth>
            <AccountCancellationContent />
        </RequireAuth>
    );
}

function AccountCancellationContent() {
    const router = useRouter();
    const { session } = useSession();
    const metadata =
        (session?.user?.metadata as Record<string, unknown> | undefined) ?? {};
    const phone =
        typeof metadata.phone === "string"
            ? metadata.phone
            : (session?.user?.phoneNumber ?? session?.user?.phone ?? null);
    const maskedPhone = maskPhone(phone);

    const handleConfirm = () => {
        Alert.alert(
            "确认注销",
            "账号注销后将清空所有信息且不可恢复，请谨慎操作。",
            [
                { text: "取消", style: "cancel" },
                {
                    text: "确定注销",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert("提示", "账号注销功能暂未开放");
                    },
                },
            ],
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="返回"
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={28} color="#222" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>注销账号</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <View style={styles.noticeCard}>
                <Text style={styles.accountTitle}>正在注销账号{maskedPhone}</Text>
                <Text style={styles.noticeTitle}>需注意：</Text>
                <Text style={styles.noticeText}>
                    1.如已加入商家，请与商家解约后再注销账号；
                    {"\n"}
                    2.已有订单且最后完成时间不满一年的账号暂不支持注销；
                    {"\n"}
                    3.订单最后完成时间已满一年的账号如需注销请联系客服；
                    {"\n"}
                    4.如需修改手机号，请在“设置”中操作，无需注销账号；
                    {"\n"}
                    5.注销后，账号内所有信息将清空且不可恢复，请谨慎操作！
                </Text>
            </View>

            <TouchableOpacity
                style={styles.confirmButton}
                accessibilityRole="button"
                onPress={handleConfirm}
            >
                <Text style={styles.confirmText}>确定注销</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    header: {
        height: 88,
        paddingTop: 44,
        paddingHorizontal: 12,
        backgroundColor: "#fff",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#ddd",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "flex-start",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "500",
        color: "#222",
    },
    headerPlaceholder: {
        width: 44,
    },
    noticeCard: {
        backgroundColor: "#fff",
        paddingHorizontal: 18,
        paddingTop: 24,
        paddingBottom: 20,
    },
    accountTitle: {
        fontSize: 22,
        lineHeight: 30,
        fontWeight: "700",
        color: "#222",
        marginBottom: 12,
    },
    noticeTitle: {
        fontSize: 14,
        lineHeight: 20,
        color: "#222",
        marginBottom: 2,
    },
    noticeText: {
        fontSize: 14,
        lineHeight: 19,
        color: "#222",
    },
    confirmButton: {
        height: 48,
        marginTop: 12,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    confirmText: {
        fontSize: 16,
        color: "#222",
    },
});
