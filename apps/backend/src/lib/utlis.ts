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
    const hours = beijingDate.getHours().toString().padStart(2, '0');
    const minutes = beijingDate.getMinutes().toString().padStart(2, '0');
    const seconds = beijingDate.getSeconds().toString().padStart(2, '0');
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
    const userTimeValue = parseInt(userTime.replace(/:/g, ''), 10);
    const startTimeValue = parseInt(startTime.replace(/:/g, ''), 10);
    const endTimeValue = parseInt(endTime.replace(/:/g, ''), 10);

    // 普通情况：开始时间 < 结束时间
    if (startTimeValue <= endTimeValue) {
        return userTimeValue >= startTimeValue && userTimeValue <= endTimeValue;
    }

    // 跨天情况：开始时间 > 结束时间
    // 用户时间 >= 开始时间 (例如 22:00:00 <= 用户时间 <= 23:59:59)
    // 或者用户时间 <= 结束时间 (例如 00:00:00 <= 用户时间 <= 06:00:00)
    return userTimeValue >= startTimeValue || userTimeValue <= endTimeValue;
}

type HmsParts = {
    hours: number;
    minutes: number;
    seconds: number;
};

function parseHms(timeStr: string): HmsParts | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.exec(timeStr);
    if (!match) {
        return null;
    }
    return {
        hours: Number(match[1]),
        minutes: Number(match[2]),
        seconds: Number(match[3]),
    };
}

/**
 * 判断 appointmentTime 是否命中“从 workStartTime 起算”的固定步长网格。
 *
 * 约定：workStartTime 形如 HH:MM:SS；网格步长默认 120 分钟。
 */
export function isAlignedToWorkStartTimeGrid(
    appointmentTime: Date,
    workStartTime: string,
    stepMinutes = 120,
): boolean {
    if (!appointmentTime || Number.isNaN(appointmentTime.getTime())) {
        return false;
    }
    if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
        return false;
    }
    const parts = parseHms(workStartTime);
    if (!parts) {
        return false;
    }

    // 使用 appointmentTime 的本地日期，拼出同一天的 workStartTime 作为网格基准。
    const base = new Date(
        appointmentTime.getFullYear(),
        appointmentTime.getMonth(),
        appointmentTime.getDate(),
        parts.hours,
        parts.minutes,
        parts.seconds,
        0,
    );

    const diffMs = appointmentTime.getTime() - base.getTime();
    if (diffMs < 0) {
        return false;
    }

    const stepMs = stepMinutes * 60 * 1000;
    return diffMs % stepMs === 0;
}
