/**
 * 服务卡片规格聚合工具
 *
 * 将 ServicePersonnelOffering 的多规格数据聚合为卡片展示所需的摘要信息。
 */

/** 单条规格数据结构（与后端 ServicePersonnelOffering.specifications 元素对齐） */
export interface ServiceSpec {
    id: string;
    name?: string;
    price: string;
    estimatedDurationMinutes?: number;
}

/** 规格聚合结果 */
export interface ServiceSpecAggregation {
    /** 所有规格中的最低价格（格式化字符串，如 "150" 或 "150.50"） */
    minPrice: string;
    /** 规格数量 */
    specCount: number;
    /** 所有规格中的最短预估时长（分钟），无有效值时返回 null */
    minDurationMinutes: number | null;
    /** 是否有规格数据 */
    hasSpecs: boolean;
    /** 第一个规格的名称，无规格时返回 null */
    firstSpecName: string | null;
}

/**
 * 将价格字符串格式化为展示用的字符串。
 *
 * 整数价格不保留小数位（如 "150"），小数价格保留两位（如 "150.50"）。
 */
function formatPrice(value: number): string {
    if (Number.isInteger(value)) {
        return String(value);
    }
    return value.toFixed(2);
}

/**
 * 聚合服务规格数据，提取卡片展示所需的摘要信息。
 *
 * @param specifications - 服务规格列表
 * @returns 聚合后的规格摘要
 *
 * @example
 * // 多规格场景
 * aggregateServiceSpecs([
 *   { id: "1", name: "标准清洁", price: "150", estimatedDurationMinutes: 60 },
 *   { id: "2", name: "深度清洁", price: "250", estimatedDurationMinutes: 120 },
 * ]);
 * // => { minPrice: "150", specCount: 2, minDurationMinutes: 60, hasSpecs: true, firstSpecName: "标准清洁" }
 *
 * @example
 * // 空数组
 * aggregateServiceSpecs([]);
 * // => { minPrice: "0", specCount: 0, minDurationMinutes: null, hasSpecs: false, firstSpecName: null }
 */
export function aggregateServiceSpecs(
    specifications: ServiceSpec[],
): ServiceSpecAggregation {
    const specCount = specifications.length;

    if (specCount === 0) {
        return {
            minPrice: "0",
            specCount: 0,
            minDurationMinutes: null,
            hasSpecs: false,
            firstSpecName: null,
        };
    }

    // 解析所有价格为数值
    const prices: number[] = [];
    const durations: number[] = [];

    for (const spec of specifications) {
        const price = parseFloat(spec.price);
        if (!Number.isNaN(price)) {
            prices.push(price);
        }
        if (
            spec.estimatedDurationMinutes !== undefined &&
            spec.estimatedDurationMinutes !== null &&
            !Number.isNaN(spec.estimatedDurationMinutes)
        ) {
            durations.push(spec.estimatedDurationMinutes);
        }
    }

    const minPrice = prices.length > 0 ? formatPrice(Math.min(...prices)) : "0";

    const minDurationMinutes =
        durations.length > 0 ? Math.min(...durations) : null;

    const firstSpecName = specifications[0].name ?? null;

    return {
        minPrice,
        specCount,
        minDurationMinutes,
        hasSpecs: true,
        firstSpecName,
    };
}

/**
 * 格式化服务卡片标签文案。
 *
 * @param type - 标签类型：`"duration"` 展示时长，`"specCount"` 展示规格数量
 * @param value - 数值（时长分钟数 或 规格数量）
 * @returns 格式化后的标签字符串，无有效值时返回 null
 *
 * @example
 * formatServiceTag("duration", 60);    // "约60分钟"
 * formatServiceTag("duration", null);  // null
 * formatServiceTag("duration", 0);     // null
 *
 * @example
 * formatServiceTag("specCount", 3);    // "3种规格"
 * formatServiceTag("specCount", 0);    // null
 * formatServiceTag("specCount", null); // null
 */
export function formatServiceTag(
    type: "duration" | "specCount",
    value: number | null,
): string | null {
    if (value === null || value <= 0) {
        return null;
    }

    switch (type) {
        case "duration":
            return `约${value}分钟`;
        case "specCount":
            return `${value}种规格`;
    }
}
