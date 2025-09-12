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
