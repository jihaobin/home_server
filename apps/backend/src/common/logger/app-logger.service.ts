import * as path from 'path';

import { ConsoleLogger, Injectable } from '@nestjs/common';
import winston, { createLogger, Logger } from 'winston';

import {
    createDetailedFormatter,
    createJsonFormatter,
    createSimpleFormatter,
} from './formatters';
import {
    DEFAULT_ERROR_FILENAME,
    DEFAULT_LOG_DIR,
    DEFAULT_LOG_FILENAME,
    DEFAULT_MAX_LOG_DAYS,
    DEFAULT_MAX_SIZE,
    LogFormatterType,
    LogLevel,
    LogTransportType,
} from './logger.constants';
import {
    IAppLogger,
    LoggerOptions,
    ConsoleTransportOptions,
    FileTransportOptions,
    RotateFileTransportOptions,
} from './logger.interface';
import {
    createConsoleTransport,
    createFileTransport,
    createRotateFileTransport,
} from './transports';

/**
 * 应用日志服务实现
 * 基于Winston的可配置日志服务
 */
@Injectable()
export class AppLoggerService extends ConsoleLogger implements IAppLogger {
    private winstonLogger: Logger;
    private contextName = '';

    /**
     * 构造函数
     * @param options 日志配置选项
     */
    constructor(private loggerOptions: LoggerOptions = {}) {
        super();

        // 设置应用名称
        if (loggerOptions.appName) {
            super.setContext(loggerOptions.appName);
        }

        // 初始化Winston日志器
        this.winstonLogger = this.createWinstonLogger(loggerOptions);
    }

    /**
     * 创建Winston日志器
     * @param options 日志配置选项
     * @returns Winston日志器实例
     */
    private createWinstonLogger(options: LoggerOptions): Logger {
        const {
            isDevelopment = process.env.NODE_ENV !== 'production',
            defaultLevel = isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
            formatter = {
                type: isDevelopment
                    ? LogFormatterType.DETAILED
                    : LogFormatterType.JSON,
                timestamp: true,
                colors: isDevelopment,
            },
        } = options;

        // 创建格式化器
        let winstonFormatter: winston.Logform.Format;
        switch (formatter.type) {
            case LogFormatterType.JSON:
                winstonFormatter = createJsonFormatter(formatter);
                break;
            case LogFormatterType.SIMPLE:
                winstonFormatter = createSimpleFormatter(formatter);
                break;
            case LogFormatterType.DETAILED:
            default:
                winstonFormatter = createDetailedFormatter(formatter);
                break;
        }

        // 配置传输器
        const transports: winston.transport[] = [];

        // 默认添加控制台传输器
        const defaultConsole = createConsoleTransport({
            level: defaultLevel,
        });
        transports.push(defaultConsole);

        // 如果是生产环境，默认添加文件日志
        if (!isDevelopment && !options.transports?.length) {
            // 常规日志文件
            const regularLogFile = createRotateFileTransport({
                filename: path.join(DEFAULT_LOG_DIR, DEFAULT_LOG_FILENAME),
                level: defaultLevel,
                maxSize: DEFAULT_MAX_SIZE,
                maxDays: DEFAULT_MAX_LOG_DAYS,
            });
            transports.push(regularLogFile);

            // 错误日志文件
            const errorLogFile = createRotateFileTransport({
                filename: path.join(DEFAULT_LOG_DIR, DEFAULT_ERROR_FILENAME),
                level: LogLevel.ERROR,
                maxSize: DEFAULT_MAX_SIZE,
                maxDays: DEFAULT_MAX_LOG_DAYS,
            });
            transports.push(errorLogFile);
        }

        // 添加用户配置的传输器
        if (options.transports?.length) {
            for (const transport of options.transports) {
                switch (transport.type) {
                    case LogTransportType.CONSOLE:
                        transports.push(
                            createConsoleTransport(
                                transport.options as ConsoleTransportOptions,
                            ),
                        );
                        break;
                    case LogTransportType.FILE:
                        transports.push(
                            createFileTransport(
                                transport.options as FileTransportOptions,
                            ),
                        );
                        break;
                    case LogTransportType.ROTATE_FILE:
                        transports.push(
                            createRotateFileTransport(
                                transport.options as RotateFileTransportOptions,
                            ),
                        );
                        break;
                }
            }
        }

        // 创建Winston日志器
        return createLogger({
            level: defaultLevel,
            format: winstonFormatter,
            defaultMeta: {
                context: this.contextName || undefined,
                service: options.appName || 'app',
            },
            transports,
        });
    }

    /**
     * 设置上下文
     * @param context 上下文名称
     */
    setContext(context: string): void {
        super.setContext(context);
        this.contextName = context;
    }

    /**
     * 将任意类型转换为字符串
     * @param value 要转换的值
     * @returns 转换后的字符串
     */
    private convertToString(value: any): string {
        if (value === null) {
            return 'null';
        }

        if (value === undefined) {
            return 'undefined';
        }

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (value instanceof Error) {
            return value.message || value.toString();
        }

        if (typeof value === 'function') {
            return value.name || value.toString();
        }

        // 对于对象和数组，尝试JSON序列化
        try {
            return JSON.stringify(value);
        } catch (error) {
            // 如果JSON序列化失败，使用toString()
            try {
                return value.toString();
            } catch (toStringError) {
                return '[Object]';
            }
        }
    }

    /**
     * 记录调试日志
     * @param message 日志消息
     * @param context 上下文
     */
    debug(message: any, context?: any): void {
        const contextStr = context
            ? this.convertToString(context)
            : this.contextName;

        if (this.loggerOptions.disableNestLogging !== true) {
            super.debug(message, contextStr);
        }

        this.winstonLogger.debug(this.convertToString(message), {
            context: contextStr,
        });
    }

    /**
     * 记录信息日志
     * @param message 日志消息
     * @param context 上下文
     */
    log(message: any, context?: any): void {
        const contextStr = context
            ? this.convertToString(context)
            : this.contextName;

        if (this.loggerOptions.disableNestLogging !== true) {
            super.log(message, contextStr);
        }

        this.winstonLogger.info(this.convertToString(message), {
            context: contextStr,
        });
    }

    /**
     * 记录警告日志
     * @param message 日志消息
     * @param context 上下文
     */
    warn(message: any, context?: any): void {
        const contextStr = context
            ? this.convertToString(context)
            : this.contextName;

        if (this.loggerOptions.disableNestLogging !== true) {
            super.warn(message, contextStr);
        }

        this.winstonLogger.warn(this.convertToString(message), {
            context: contextStr,
        });
    }

    /**
     * 记录错误日志
     * @param message 日志消息
     * @param trace 堆栈跟踪
     * @param context 上下文
     */
    error(message: any, trace?: string, context?: any): void {
        const contextStr = context
            ? this.convertToString(context)
            : this.contextName;

        if (this.loggerOptions.disableNestLogging !== true) {
            super.error(message, trace, contextStr);
        }

        this.winstonLogger.error(this.convertToString(message), {
            context: contextStr,
            stack: trace,
        });
    }

    /**
     * 记录HTTP请求日志
     * @param message 日志消息
     * @param context 上下文
     */
    http(message: any, context?: any): void {
        const contextStr = context
            ? this.convertToString(context)
            : this.contextName;
        this.winstonLogger.http(this.convertToString(message), {
            context: contextStr,
        });
    }
}
