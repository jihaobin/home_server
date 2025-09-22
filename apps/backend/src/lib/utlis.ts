export function extractParams(utcTimeStr: Date): {
	weekday: number;
	timeStr: string;
} {
	// 解析UTC时间字符串
	const date = new Date(utcTimeStr);

	// 转换为北京时间（UTC+8）
	const beijingDate = new Date(date.getTime());

	// 提取星期几：JavaScript的getDay()返回0（周日）到6（周六），转换为1（周一）到7（周日）
	let weekday = beijingDate.getDay();
	if (weekday === 0) {
		weekday = 7; // 周日转换为7
	}

	// 提取时间字符串（HH:MM:SS）
	const hours = beijingDate.getHours().toString().padStart(2, "0");
	const minutes = beijingDate.getMinutes().toString().padStart(2, "0");
	const seconds = beijingDate.getSeconds().toString().padStart(2, "0");
	const timeStr = `${hours}:${minutes}:${seconds}`;

	return { weekday, timeStr };
}

/**
 * 判断给定时间是否在指定的时间区间内（支持跨天情况）
 *
 * @param userTime 用户时间 (格式: HH:MM:SS)
 * @param startTime 开始时间 (格式: HH:MM:SS)
 * @param endTime 结束时间 (格式: HH:MM:SS)
 * @returns 如果用户时间在区间内返回true，否则返回false
 */

export function isTimeInRange(
	userTime: string,
	startTime: string,
	endTime: string,
): boolean {
	// 将时间字符串转换为数值进行比较 (例如 "09:30:00" => 93000)
	const userTimeValue = parseInt(userTime.replace(/:/g, ""), 10);
	const startTimeValue = parseInt(startTime.replace(/:/g, ""), 10);
	const endTimeValue = parseInt(endTime.replace(/:/g, ""), 10);

	// 普通情况：开始时间 < 结束时间
	if (startTimeValue <= endTimeValue) {
		return userTimeValue >= startTimeValue && userTimeValue <= endTimeValue;
	}

	// 跨天情况：开始时间 > 结束时间
	// 用户时间 >= 开始时间 (例如 22:00:00 <= 用户时间 <= 23:59:59)
	// 或者用户时间 <= 结束时间 (例如 00:00:00 <= 用户时间 <= 06:00:00)
	return userTimeValue >= startTimeValue || userTimeValue <= endTimeValue;
}
