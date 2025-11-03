import { LoggerService } from '@nestjs/common';

import {
    LogFormatterType,
    LogLevel,
    LogTransportType,
} from './logger.constants';

/**
 * 日志格式化器配置
 */
export interface LogFormatterOptions {
    // 格式化器类型
    type: LogFormatterType;
    // 是否包含时间戳
    timestamp?: boolean;
    // 是否包含颜色
    colors?: boolean;
}

/**
 * 文件日志配置
 */
export interface FileTransportOptions {
    // 日志文件路径
    filename: string;
    // 日志级别
    level?: LogLevel;
    // 最大文件大小
    maxSize?: string;
    // 保留的最大文件数
    maxFiles?: number;
    // 是否压缩
    zippedArchive?: boolean;
}

/**
 * 轮转文件日志配置
 */
export interface RotateFileTransportOptions extends FileTransportOptions {
    // 日期模式
    datePattern?: string;
    // 保留天数
    maxDays?: number;
}

/**
 * 控制台日志配置
 */
export interface ConsoleTransportOptions {
    // 日志级别
    level?: LogLevel;
    // 是否使用颜色
    colors?: boolean;
}

/**
 * 日志传输器配置
 */
export interface LogTransportOptions {
    // 传输器类型
    type: LogTransportType;
    // 传输器配置
    options:
        | ConsoleTransportOptions
        | FileTransportOptions
        | RotateFileTransportOptions;
}

/**
 * 日志配置选项
 */
export interface LoggerOptions {
    // 应用名称
    appName?: string;
    // 是否为开发环境
    isDevelopment?: boolean;
    // 默认日志级别
    defaultLevel?: LogLevel;
    // 是否禁用Nest内置日志
    disableNestLogging?: boolean;
    // 日志格式配置
    formatter?: LogFormatterOptions;
    // 日志输出目标配置
    transports?: LogTransportOptions[];
}

/**
 * 扩展的日志服务接口
 */
export interface IAppLogger extends LoggerService {
    // 扩展方法，记录HTTP请求日志
    http(message: unknown, context?: any): void;

    // 设置上下文
    setContext(context: string): void;

    // 重写基础日志方法以支持任意类型的context
    debug(message: any, context?: any): void;
    log(message: any, context?: any): void;
    warn(message: any, context?: any): void;
    error(message: any, stack?: string, context?: any): void;
}
