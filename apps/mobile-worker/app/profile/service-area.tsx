import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useUpsertWorkInfo } from "@repo/hooks/api/work-skill";
import { useGeocode } from "@repo/hooks/api/address";
import { DateTimePicker } from "@repo/mobile-ui/components/ui/date-time-picker";
import type { GeocodeResult } from "@repo/types";

const WEEK_DAYS = ["1", "2", "3", "4", "5", "6", "7"];
const WEEKDAY_MAP: Record<string, string> = {
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
    "7": "日",
};

const normalizeAddressPart = (value: string | null | undefined) => {
    const normalized = (value ?? "").trim();
    return normalized === "未设置" ? "" : normalized;
};

const composeFullAddress = (
    province: string,
    cityOrDistrict: string,
    county: string,
    detail: string,
) =>
    [province, cityOrDistrict, county, detail]
        .map(normalizeAddressPart)
        .filter(Boolean)
        .join("");

const normalizeAdministrativeFields = (
    components: GeocodeResult["address_components"],
) => {
    const provinceName = components.province ?? "";
    const cityName = components.city ?? "";
    const districtName = components.district ?? "";
    const isMunicipality =
        provinceName !== "" && cityName !== "" && provinceName === cityName;

    return {
        province: provinceName,
        cityOrDistrict: isMunicipality
            ? districtName || cityName
            : cityName || provinceName,
        countyOrTown: isMunicipality ? "" : districtName,
    };
};

const parseTimeString = (value: string) => {
    const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
    const date = new Date();
    date.setHours(Number.parseInt(hours, 10) || 0);
    date.setMinutes(Number.parseInt(minutes, 10) || 0);
    date.setSeconds(Number.parseInt(seconds, 10) || 0);
    date.setMilliseconds(0);
    return date;
};

const formatTimeValue = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds(),
    )}`;
};

export default function ServiceAreaScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;
    const { data: profile, isFetching, refetch } = useServicePersonnelProfile(userId);
    const upsertWorkInfo = useUpsertWorkInfo();
    const { mutateAsync: geocodeAddress, isPending: isGeocoding } = useGeocode();

    const [province, setProvince] = useState("");
    const [district, setDistrict] = useState("");
    const [county, setCounty] = useState("");
    const [address, setAddress] = useState("");
    const [lng, setLng] = useState("");
    const [lat, setLat] = useState("");
    const [workStartTime, setWorkStartTime] = useState("08:00:00");
    const [workEndTime, setWorkEndTime] = useState("18:00:00");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [lastGeocodedAddress, setLastGeocodedAddress] = useState("");
    const [geocodeError, setGeocodeError] = useState<string | null>(null);

    const existingLocation = profile
        ? ((profile as any).location as { lng: number; lat: number } | null)
        : null;

    const fullAddress = useMemo(
        () => composeFullAddress(province, district, county, address),
        [province, district, county, address],
    );
    const isGeocodeReady = useMemo(
        () =>
            Boolean(
                normalizeAddressPart(province) &&
                normalizeAddressPart(district) &&
                normalizeAddressPart(address),
            ),
        [province, district, address],
    );

    useEffect(() => {
        if (!profile) return;
        const normalizedProvince = normalizeAddressPart(profile.province);
        const normalizedDistrict = normalizeAddressPart(profile.district);
        const normalizedCounty = normalizeAddressPart(profile.county);
        const normalizedAddress = normalizeAddressPart(profile.detailedAddress);
        setProvince(normalizedProvince);
        setDistrict(normalizedDistrict);
        setCounty(normalizedCounty);
        setAddress(normalizedAddress);
        setWorkStartTime(profile.workStartTime ?? "08:00:00");
        setWorkEndTime(profile.workEndTime ?? "18:00:00");
        setSelectedDays(profile.workDays ? profile.workDays.split("") : ["1", "2", "3", "4", "5", "6", "7"]);
        setLng(
            existingLocation && typeof existingLocation.lng === "number"
                ? existingLocation.lng.toString()
                : "",
        );
        setLat(
            existingLocation && typeof existingLocation.lat === "number"
                ? existingLocation.lat.toString()
                : "",
        );
        const normalized = composeFullAddress(
            normalizedProvince,
            normalizedDistrict,
            normalizedCounty,
            normalizedAddress,
        );
        setLastGeocodedAddress(existingLocation ? normalized : "");
        setGeocodeError(null);
    }, [existingLocation, profile]);

    const applyGeocodeResult = useCallback(
        (result: GeocodeResult) => {
            const normalized = normalizeAdministrativeFields(
                result.address_components,
            );
            setProvince(normalized.province);
            setDistrict(normalized.cityOrDistrict);
            setCounty(normalized.countyOrTown);
            setLng(result.location.lng.toString());
            setLat(result.location.lat.toString());
            const normalizedFullAddress = composeFullAddress(
                normalized.province,
                normalized.cityOrDistrict,
                normalized.countyOrTown,
                normalizeAddressPart(address),
            );
            setLastGeocodedAddress(normalizedFullAddress);
            setGeocodeError(null);
            return result.location;
        },
        [address],
    );

    useEffect(() => {
        if (!isGeocodeReady) {
            setLastGeocodedAddress("");
            setLat("");
            setLng("");
            setGeocodeError(null);
            return;
        }

        if (fullAddress === lastGeocodedAddress) {
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            geocodeAddress({ address: fullAddress })
                .then((result) => {
                    if (cancelled) return;
                    applyGeocodeResult(result);
                })
                .catch((error) => {
                    if (cancelled) return;
                    console.error("[ServiceArea] 地址解析失败", error);
                    setGeocodeError("无法解析该地址，请检查输入");
                });
        }, 800);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        applyGeocodeResult,
        fullAddress,
        geocodeAddress,
        isGeocodeReady,
        lastGeocodedAddress,
    ]);

    const handleManualGeocode = useCallback(async () => {
        if (!isGeocodeReady) {
            Alert.alert("提示", "请按要求填写省份、城市/城区和详细地址");
            return;
        }

        try {
            const result = await geocodeAddress({ address: fullAddress });
            applyGeocodeResult(result);
        } catch (error) {
            console.error("[ServiceArea] 手动解析失败", error);
            Alert.alert("提示", "地址解析失败，请稍后重试");
        }
    }, [applyGeocodeResult, fullAddress, geocodeAddress, isGeocodeReady]);

    const ensureCoordinates = useCallback(async () => {
        if (!isGeocodeReady) {
            throw new Error("请按“省份-城市/城区-县/乡-详细地址”填写完整地址");
        }

        if (fullAddress === lastGeocodedAddress && lng && lat) {
            const lngValue = Number.parseFloat(lng);
            const latValue = Number.parseFloat(lat);
            if (!Number.isNaN(lngValue) && !Number.isNaN(latValue)) {
                return { lng: lngValue, lat: latValue };
            }
        }

        const result = await geocodeAddress({ address: fullAddress });
        return applyGeocodeResult(result);
    }, [
        applyGeocodeResult,
        fullAddress,
        geocodeAddress,
        isGeocodeReady,
        lastGeocodedAddress,
        lat,
        lng,
    ]);

    const toggleDay = (day: string) => {
        setSelectedDays((prev) =>
            prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
        );
    };

    const orderedWorkDays = useMemo(() => selectedDays.slice().sort().join(""), [selectedDays]);

    const handleSave = useCallback(async () => {
        if (!profile) return;

        const normalizedProvince = normalizeAddressPart(province);
        const normalizedDistrict = normalizeAddressPart(district);
        const normalizedCounty = normalizeAddressPart(county);
        const normalizedAddress = normalizeAddressPart(address);

        if (!normalizedProvince || !normalizedDistrict || !normalizedAddress) {
            Alert.alert("提示", "请按照要求填写省份、城市/城区和详细地址");
            return;
        }

        if (selectedDays.length === 0) {
            Alert.alert("提示", "请至少选择一个工作日");
            return;
        }

        setSaving(true);
        try {
            const location = await ensureCoordinates();

            await upsertWorkInfo.mutateAsync({
                bio: profile.bio ?? undefined,
                yearsOfExperience: profile.yearsOfExperience ?? 0,
                province: normalizedProvince,
                district: normalizedDistrict,
                county: normalizedCounty,
                detailedAddress: normalizedAddress,
                workStartTime,
                workEndTime,
                workDays: orderedWorkDays,
                isAvailable: profile.isAvailable,
                currentStatus: profile.currentStatus,
                location,
            });
            await refetch();
            Alert.alert("保存成功", "服务区域已更新", [
                { text: "好的", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error("[ServiceArea] 保存失败", error);
            const message =
                error instanceof Error ? error.message : "请稍后重试";
            Alert.alert("保存失败", message);
        } finally {
            setSaving(false);
        }
    }, [
        address,
        county,
        district,
        orderedWorkDays,
        profile,
        province,
        refetch,
        router,
        selectedDays,
        ensureCoordinates,
        upsertWorkInfo,
        workEndTime,
        workStartTime,
    ]);

    const isLoading = isFetching && !profile;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>服务区域与时间</Text>
                <TouchableOpacity
                    style={styles.saveButton}
                    disabled={saving || !profile}
                    onPress={handleSave}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#2196F3" />
                    ) : (
                        <Text style={styles.saveText}>保存</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {isLoading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#2196F3" />
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>服务区域</Text>
                            <InputRow
                                label="省份"
                                value={province}
                                placeholder="如: 北京市"
                                onChangeText={setProvince}
                            />
                            <InputRow
                                label="城市/城区"
                                value={district}
                                placeholder="如: 杭州市 / 朝阳区"
                                onChangeText={setDistrict}
                            />
                            <InputRow
                                label="县/乡"
                                value={county}
                                placeholder="如: 顺德区(省级市可不填)"
                                onChangeText={setCounty}
                            />
                            <View style={styles.formItemColumn}>
                                <Text style={styles.label}>详细地址</Text>
                                <TextInput
                                    style={styles.textArea}
                                    value={address}
                                    onChangeText={setAddress}
                                    placeholder="例如：望京 SOHO T3"
                                    multiline
                                />
                            </View>
                            <Text style={styles.ruleText}>
                                请按“省份-城市/城区-县/乡-详细地址”的顺序填写；遇到直辖市仅填写省份和城区即可。
                            </Text>
                            <View style={styles.coordCard}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.coordLabel}>经纬度（自动获取）</Text>
                                    {lng && lat ? (
                                        <Text style={styles.coordValue}>
                                            {lng}, {lat}
                                        </Text>
                                    ) : (
                                        <Text style={styles.coordPlaceholder}>
                                            请填写完整地址以自动解析
                                        </Text>
                                    )}
                                    {geocodeError ? (
                                        <Text style={styles.errorText}>{geocodeError}</Text>
                                    ) : (
                                        <Text style={styles.helperText}>
                                            经纬度通过腾讯地图解析，无需手动填写
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.coordActionButton,
                                        (!isGeocodeReady || isGeocoding) &&
                                        styles.coordActionButtonDisabled,
                                    ]}
                                    onPress={handleManualGeocode}
                                    disabled={isGeocoding || !isGeocodeReady}
                                >
                                    {isGeocoding ? (
                                        <ActivityIndicator size="small" color="#2196F3" />
                                    ) : (
                                        <Text style={styles.coordActionText}>重新获取</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>工作时间</Text>
                            <TimePickerField
                                label="开始"
                                value={workStartTime}
                                onConfirm={setWorkStartTime}
                            />
                            <TimePickerField
                                label="结束"
                                value={workEndTime}
                                onConfirm={setWorkEndTime}
                            />
                            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
                                工作日
                            </Text>
                            <View style={styles.weekContainer}>
                                {WEEK_DAYS.map((day) => (
                                    <TouchableOpacity
                                        key={day}
                                        style={[
                                            styles.weekBadge,
                                            selectedDays.includes(day) && styles.weekBadgeActive,
                                        ]}
                                        onPress={() => toggleDay(day)}
                                    >
                                        <Text
                                            style={[
                                                styles.weekBadgeText,
                                                selectedDays.includes(day) && styles.weekBadgeTextActive,
                                            ]}
                                        >
                                            周{WEEKDAY_MAP[day]}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function InputRow({
    label,
    ...rest
}: {
    label: string;
    value: string;
    placeholder?: string;
    onChangeText: (text: string) => void;
    keyboardType?: "default" | "numeric";
}) {
    return (
        <View style={styles.formItem}>
            <Text style={styles.label}>{label}</Text>
            <TextInput style={styles.input} {...rest} />
        </View>
    );
}

function TimePickerField({
    label,
    value,
    onConfirm,
}: {
    label: string;
    value: string;
    onConfirm: (time: string) => void;
}) {
    const [visible, setVisible] = useState(false);
    const [previewDate, setPreviewDate] = useState(() => parseTimeString(value));

    useEffect(() => {
        if (!visible) {
            setPreviewDate(parseTimeString(value));
        }
    }, [value, visible]);

    const handleClose = () => setVisible(false);
    const handleConfirm = () => {
        onConfirm(formatTimeValue(previewDate));
        setVisible(false);
    };

    return (
        <>
            <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setVisible(true)}
                activeOpacity={0.8}
            >
                <Text style={styles.label}>{label}</Text>
                <View style={styles.timeValueBox}>
                    <Text style={styles.timeValue}>{value}</Text>
                    <Ionicons name="time-outline" size={16} color="#555" />
                </View>
            </TouchableOpacity>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={handleClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>选择{label}时间</Text>
                        <DateTimePicker
                            mode="single"
                            timePicker
                            initialView="time"
                            locale="zh-cn"
                            hideHeader
                            date={previewDate}
                            onChange={({ date }) => {
                                if (!date) return;
                                const resolved =
                                    date instanceof Date
                                        ? date
                                        : new Date(date as string);
                                setPreviewDate(resolved);
                            }}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={handleClose}
                            >
                                <Text style={styles.modalButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonSpacing,
                                    styles.modalButtonPrimary,
                                ]}
                                onPress={handleConfirm}
                            >
                                <Text
                                    style={[
                                        styles.modalButtonText,
                                        styles.modalButtonPrimaryText,
                                    ]}
                                >
                                    确定
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fb",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 16,
        backgroundColor: "white",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#eee",
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: "#111",
    },
    saveButton: {
        minWidth: 60,
        alignItems: "flex-end",
        padding: 4,
    },
    saveText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2196F3",
    },
    content: {
        flex: 1,
    },
    loader: {
        paddingTop: 80,
        alignItems: "center",
    },
    card: {
        backgroundColor: "white",
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
        marginBottom: 16,
    },
    formItem: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
    },
    formItemColumn: {
        marginBottom: 14,
    },
    label: {
        width: 80,
        fontSize: 14,
        color: "#555",
    },
    input: {
        flex: 1,
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: "#111",
    },
    textArea: {
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#111",
        minHeight: 80,
    },
    coordRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        marginBottom: 8,
    },
    helperText: {
        fontSize: 12,
        color: "#999",
        marginTop: 8,
    },
    ruleText: {
        fontSize: 12,
        color: "#666",
        marginBottom: 8,
    },
    weekContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    weekBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d1d5db",
    },
    weekBadgeActive: {
        backgroundColor: "#e0f2fe",
        borderColor: "#38bdf8",
    },
    weekBadgeText: {
        fontSize: 13,
        color: "#555",
    },
    weekBadgeTextActive: {
        color: "#0284c7",
        fontWeight: "600",
    },
    coordCard: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#f3f4f6",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#e5e7eb",
    },
    coordLabel: {
        fontSize: 13,
        color: "#555",
        marginBottom: 4,
    },
    coordValue: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
    },
    coordPlaceholder: {
        fontSize: 14,
        color: "#888",
    },
    coordActionButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "#fff",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#d1d5db",
        marginLeft: 12,
    },
    coordActionButtonDisabled: {
        opacity: 0.5,
    },
    coordActionText: {
        fontSize: 14,
        color: "#2196F3",
        fontWeight: "600",
    },
    errorText: {
        fontSize: 12,
        color: "#dc2626",
        marginTop: 6,
    },
    timeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    timeValueBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    timeValue: {
        fontSize: 15,
        color: "#111",
        marginRight: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalCard: {
        width: "100%",
        borderRadius: 16,
        backgroundColor: "#fff",
        padding: 20,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 16,
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
    },
    modalButtonSpacing: {
        marginLeft: 12,
    },
    modalButtonPrimary: {
        backgroundColor: "#2196F3",
    },
    modalButtonText: {
        fontSize: 14,
        color: "#111",
    },
    modalButtonPrimaryText: {
        color: "#fff",
        fontWeight: "600",
    },
});
