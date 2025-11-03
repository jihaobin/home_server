import * as fs from 'fs';
import * as path from 'path';

import * as winston from 'winston';
import 'winston-daily-rotate-file';

import { LogLevel } from '../logger.constants';
import { RotateFileTransportOptions } from '../logger.interface';

/**
 * 创建轮转文件日志传输器
 * @param options 轮转文件传输器选项
 * @returns Winston轮转文件传输器
 */
export const createRotateFileTransport = (
    options: RotateFileTransportOptions,
): winston.transport => {
    const {
        filename,
        level = LogLevel.INFO,
        maxSize = '20m',
        datePattern = 'YYYY-MM-DD',
        maxDays = 14,
        zippedArchive = true,
    } = options;

    // 确保日志目录存在
    const dirname = path.dirname(filename);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }

    return new winston.transports.DailyRotateFile({
        filename,
        datePattern,
        level,
        maxSize,
        maxFiles: `${maxDays}d`,
        zippedArchive,
    });
};
