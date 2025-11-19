import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import useServiceStore from "@/stores/service";

const ICON_MAP = lucideIconRegistry;

// 默认配置（如果后台没有返回）
const DEFAULT_WORK_DAYS = "1234567"; // 默认一周7天都工作
const DEFAULT_WORK_START_TIME = "08:00:00";
const DEFAULT_WORK_END_TIME = "20:00:00";
const TIME_SLOT_INTERVAL = 30; // 30分钟间隔

// 夜间时段 (17:00-7:00)
const NIGHT_START_HOUR = 17;
const NIGHT_END_HOUR = 7;

interface TimeSlot {
	hour: number;
	minute: number;
	label: string;
	isNight: boolean;
	isPast: boolean;
	isDisabled: boolean;
}

interface DayOption {
	date: Date;
	label: string;
	dateLabel: string;
	isPast: boolean;
}

export default function ServiceTimePickerScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		workDays?: string;
		workStartTime?: string;
		workEndTime?: string;
	}>();
	const { setServiceTime } = useServiceStore();

	const [selectedDay, setSelectedDay] = useState<Date | null>(null);
	const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
	const [refreshCounter, setRefreshCounter] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// 从参数中获取工作配置，如果没有则使用默认值
	const workDays = params.workDays || DEFAULT_WORK_DAYS;
	const workStartTime = params.workStartTime || DEFAULT_WORK_START_TIME;
	const workEndTime = params.workEndTime || DEFAULT_WORK_END_TIME;

	// 解析工作时间
	const parseTime = (timeStr: string): { hour: number; minute: number } => {
		const [hour, minute] = timeStr.split(":").map(Number);
		return { hour, minute };
	};

	const workStart = parseTime(workStartTime);
	const workEnd = parseTime(workEndTime);

	// 检查某一天是否是工作日
	const isWorkDay = (date: Date): boolean => {
		const dayOfWeek = date.getDay(); // 0-6 (周日-周六)
		// 将JS的周日(0)转换为我们的系统(7)，其他的1-6保持不变
		const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;
		return workDays.includes(dayNumber.toString());
	};

	// 生成接下来半个月的日期选项（只显示工作日）
	const dayOptions = useMemo<DayOption[]>(() => {
		const options: DayOption[] = [];
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		// 收集最多15个工作日
		let daysChecked = 0;
		let workDaysFound = 0;
		const maxDaysToCheck = 30; // 最多往后查找30天

		while (workDaysFound < 15 && daysChecked < maxDaysToCheck) {
			const date = new Date(today);
			date.setDate(today.getDate() + daysChecked);

			// 只添加工作日
			if (isWorkDay(date)) {
				let label = "";
				if (daysChecked === 0) {
					label = "今天";
				} else if (daysChecked === 1) {
					label = "明天";
				} else {
					const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
					label = weekdays[date.getDay()];
				}

				const dateLabel = `${date.getMonth() + 1}-${date.getDate()}`;

				options.push({
					date,
					label,
					dateLabel,
					isPast: date < today,
				});

				workDaysFound++;
			}

			daysChecked++;
		}

		return options;
	}, [workDays, refreshCounter]);

	// 生成时间段选项（根据工作时间）
	const timeSlots = useMemo<TimeSlot[]>(() => {
		const slots: TimeSlot[] = [];
		const now = new Date();

		// 从工作开始时间到工作结束时间
		let currentHour = workStart.hour;
		let currentMinute = workStart.minute;

		while (
			currentHour < workEnd.hour ||
			(currentHour === workEnd.hour && currentMinute < workEnd.minute)
		) {
			const isNight =
				currentHour >= NIGHT_START_HOUR || currentHour < NIGHT_END_HOUR;

			// 检查是否已过期（如果是今天）
			let isPast = false;
			if (selectedDay) {
				const slotTime = new Date(selectedDay);
				slotTime.setHours(currentHour, currentMinute, 0, 0);
				isPast = slotTime < now;
			}

			const label = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;

			slots.push({
				hour: currentHour,
				minute: currentMinute,
				label,
				isNight,
				isPast,
				isDisabled: isPast,
			});

			// 增加时间间隔
			currentMinute += TIME_SLOT_INTERVAL;
			if (currentMinute >= 60) {
				currentMinute = 0;
				currentHour++;
			}
		}

		return slots;
	}, [selectedDay, workStartTime, workEndTime, refreshCounter]);

	// 初始化选中今天
	useMemo(() => {
		if (!selectedDay && dayOptions.length > 0) {
			setSelectedDay(dayOptions[0].date);
		}
	}, [dayOptions, selectedDay]);

	const handleConfirm = useCallback(() => {
		if (selectedDay && selectedTime) {
			const finalDateTime = new Date(selectedDay);
			finalDateTime.setHours(selectedTime.hour, selectedTime.minute, 0, 0);
			setServiceTime(finalDateTime);
			router.back();
		}
	}, [selectedDay, selectedTime, setServiceTime, router]);

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true);
		setSelectedDay(null);
		setSelectedTime(null);
		setRefreshCounter((prev) => prev + 1);
		setTimeout(() => {
			setIsRefreshing(false);
		}, 300);
	}, []);

	return (
		<View className="flex-1 bg-background">
			{/* 顶部导航栏 */}
			<View className="border-b border-border bg-background px-4 pt-12 pb-3">
				<View className="flex-row items-center justify-between">
					<Pressable
						onPress={() => router.back()}
						className="h-10 w-10 items-center justify-center active:opacity-60"
						hitSlop={8}
					>
						<Icon
							as={ICON_MAP.ChevronLeft}
							size={24}
							className="text-foreground"
						/>
					</Pressable>
					<Text className="text-lg font-semibold text-foreground">
						选择时间
					</Text>
					<View className="w-10" />
				</View>
			</View>

			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
				}
			>
				{/* 日期选择 */}
				<View className="border-b border-border bg-background">
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						className="px-4 py-4"
						contentContainerStyle={{ gap: 12 }}
					>
						{dayOptions.map((day) => (
							<Pressable
								key={day.date.toISOString()}
								onPress={() => {
									setSelectedDay(day.date);
									setSelectedTime(null); // 重置时间选择
								}}
								disabled={day.isPast}
								className={cn(
									"items-center rounded-xl px-4 py-3 min-w-[80px]",
									selectedDay?.toDateString() === day.date.toDateString()
										? "bg-primary"
										: "bg-card border border-border",
									day.isPast && "opacity-40",
								)}
							>
								<Text
									className={cn(
										"text-sm font-medium mb-1",
										selectedDay?.toDateString() === day.date.toDateString()
											? "text-primary-foreground"
											: "text-muted-foreground",
									)}
								>
									{day.label}
								</Text>
								<Text
									className={cn(
										"text-base font-semibold",
										selectedDay?.toDateString() === day.date.toDateString()
											? "text-primary-foreground"
											: "text-foreground",
									)}
								>
									{day.dateLabel}
								</Text>
							</Pressable>
						))}
					</ScrollView>
				</View>

				{/* 时间段选择 */}
				<View className="px-4 py-4">
					<View className="flex-row flex-wrap gap-3">
						{timeSlots.map((slot) => (
							<Pressable
								key={slot.label}
								onPress={() => setSelectedTime(slot)}
								disabled={slot.isDisabled}
								className={cn(
									"items-center justify-center rounded-lg px-4 py-3",
									"w-[22%]", // 4列布局
									selectedTime?.label === slot.label
										? "bg-primary border-2 border-primary"
										: "bg-card border border-border",
									slot.isDisabled && "opacity-30",
								)}
							>
								<Text
									className={cn(
										"text-sm font-medium",
										selectedTime?.label === slot.label
											? "text-primary-foreground"
											: "text-foreground",
									)}
								>
									{slot.label}
								</Text>
								{slot.isNight && !slot.isDisabled && (
									<View className="mt-1 rounded-full bg-accent/20 px-2 py-0.5">
										<Text className={cn("text-xs text-accent-foreground",selectedTime?.label === slot.label
											? "text-primary-foreground"
											: "text-foreground",)}>
											夜间
										</Text>
									</View>
								)}
								{slot.isPast && (
									<View className="mt-1 rounded-full bg-muted px-2 py-0.5">
										<Text className="text-xs text-muted-foreground">
											已过
										</Text>
									</View>
								)}
							</Pressable>
						))}
					</View>
				</View>

				{/* 提示信息 */}
				<View className="px-4 pb-6">
					<Text className="text-xs text-center text-muted-foreground mb-2">
						实际到达时间可能会有30分钟的浮动
					</Text>
				</View>
			</ScrollView>

			{/* 底部确认按钮 */}
			<View
				className="border-t border-border bg-background px-4 py-3 shadow-2xl"
			>
				<Button
					onPress={handleConfirm}
					disabled={!selectedDay || !selectedTime}
					className={cn(
						"items-center justify-center rounded-full",
						!selectedDay || !selectedTime ? "bg-muted" : "bg-primary",
					)}
				>
					<Text
						className={cn(
							"text-base font-semibold",
							!selectedDay || !selectedTime
								? "text-muted-foreground"
								: "text-primary-foreground",
						)}
					>
						确定选择
					</Text>
				</Button>
			</View>
		</View>
	);
}
