/**
 * 日志模块常量定义
 */

// 日志级别
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    HTTP = 'http',
    DEBUG = 'debug',
}

// 日志格式化器类型
export enum LogFormatterType {
    JSON = 'json',
    SIMPLE = 'simple',
    DETAILED = 'detailed',
}

// 日志输出目标类型
export enum LogTransportType {
    CONSOLE = 'console',
    FILE = 'file',
    ROTATE_FILE = 'rotate-file',
}

// 默认日志目录
export const DEFAULT_LOG_DIR = 'logs';

// 默认日志文件名模式
export const DEFAULT_LOG_FILENAME = 'application-%DATE%.log';

// 默认错误日志文件名模式
export const DEFAULT_ERROR_FILENAME = 'error-%DATE%.log';

// 默认日志保留天数
export const DEFAULT_MAX_LOG_DAYS = 90;

// 默认日志文件最大大小
export const DEFAULT_MAX_SIZE = '20m';
