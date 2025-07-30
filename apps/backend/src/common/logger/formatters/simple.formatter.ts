import { format } from 'winston';
import type { Logform } from 'winston';

import { LogFormatterOptions } from '../logger.interface';

/**
 * 创建简单格式的日志格式化器
 * @param options 格式化器选项
 * @returns Winston格式化器
 */
export const createSimpleFormatter = (
    options: LogFormatterOptions,
): Logform.Format => {
    const { timestamp = true, colors = true } = options;

    return format.combine(
        format.errors({ stack: true }),
        timestamp
            ? format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
            : format.simple(),
        format.printf((info) => {
            const { timestamp, level, message, context, ...meta } = info;
            const contextStr = context ? `[${context}] ` : '';
            const metaStr = Object.keys(meta).length
                ? `\n${JSON.stringify(meta, null, 2)}`
                : '';

            return `${timestamp ? `${timestamp} ` : ''}${level.toUpperCase()} ${contextStr}${message}${metaStr}`;
        }),
        colors ? format.colorize({ all: true }) : format.simple(),
    );
};
