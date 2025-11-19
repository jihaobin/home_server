import { format } from 'winston';
import type { Logform } from 'winston';

import { LogFormatterOptions } from '../logger.interface';

/**
 * 创建详细格式的日志格式化器
 * @param options 格式化器选项
 * @returns Winston格式化器
 */
export const createDetailedFormatter = (
    options: LogFormatterOptions,
): Logform.Format => {
    const { timestamp = true, colors = true } = options;

    return format.combine(
        format.errors({ stack: true }),
        timestamp
            ? format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
            : format.simple(),
        format.printf((info) => {
            const { timestamp, level, message, context, stack, ...meta } = info;
            const pid = process.pid;
            const contextStr = context
                ? `[${typeof context === 'string' ? context : JSON.stringify(context)}] `
                : '';
            const timestampStr = timestamp
                ? `[${typeof timestamp === 'string' ? timestamp : JSON.stringify(timestamp)}] `
                : '';
            const stackStr = stack
                ? `[${typeof stack === 'string' ? stack : JSON.stringify(stack)}] `
                : '';

            let metaStr = '';
            if (Object.keys(meta).length) {
                metaStr = `\n${JSON.stringify(meta, null, 2)}`;
            }

            return `${timestampStr}[${pid}] ${level.toUpperCase()} ${contextStr}${message as string}${stackStr}${metaStr}`;
        }),
        colors ? format.colorize({ all: true }) : format.simple(),
    );
};
