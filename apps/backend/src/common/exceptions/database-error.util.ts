import { ErrorCode } from '@repo/types';
import { DatabaseException } from './app.exception';

/**
 * 数据库错误类型
 */
export enum DatabaseErrorType {
    UNIQUE_VIOLATION = 'unique_violation',
    FOREIGN_KEY_VIOLATION = 'foreign_key_violation',
    NOT_NULL_VIOLATION = 'not_null_violation',
    CHECK_VIOLATION = 'check_violation',
    CONNECTION_ERROR = 'connection_error',
}

/**
 * 数据库错误接口
 */
export interface DatabaseError {
    message?: string;
    code?: string;
    errno?: number;
    constraint?: string;
    column?: string;
    stack?: string;
    name?: string;
    sqlState?: string;
    sqlMessage?: string;
    [key: string]: unknown;
}

/**
 * 详情记录类型
 */
export interface ErrorDetails {
    originalError?: {
        message: string;
        code: string;
    };
    constraint?: string;
    column?: string;
    message?: string;
    [key: string]: unknown;
}

/**
 * 处理数据库错误
 * 将原始数据库错误转换为应用异常
 * @param error 原始错误
 * @returns 应用异常
 */
export function handleDatabaseError(error: DatabaseError): DatabaseException {
    // 默认错误信息和代码
    let message = '操作失败，请重试';
    let errorCode = ErrorCode.DATABASE_ERROR;
    const details: ErrorDetails = {};

    // 尝试提取详细信息
    if (error && typeof error === 'object') {
        // 保存原始错误信息
        details.originalError = {
            message: error.message || '未知错误',
            code: error.code || 'UNKNOWN',
        };

        // PostgreSQL错误处理
        if (error.code) {
            switch (error.code) {
                // 唯一约束违反
                case '23505':
                    message = '该信息已存在，请勿重复添加';
                    errorCode = ErrorCode.UNIQUE_VIOLATION;
                    details.constraint = error.constraint;
                    break;

                // 外键约束违反
                case '23503':
                    message = '相关数据不存在，请检查后重试';
                    errorCode = ErrorCode.FOREIGN_KEY_ERROR;
                    details.constraint = error.constraint;
                    break;

                // 非空约束违反
                case '23502':
                    message = '必填信息不能为空，请完整填写';
                    errorCode = ErrorCode.NOT_NULL_VIOLATION;
                    details.column = error.column;
                    break;

                // 检查约束违反
                case '23514':
                    message = '输入的信息格式不正确，请重新填写';
                    errorCode = ErrorCode.CONSTRAINT_ERROR;
                    details.constraint = error.constraint;
                    break;

                // 连接错误
                case '08000':
                case '08003':
                case '08006':
                    message = '系统暂时无法连接，请稍后重试';
                    errorCode = ErrorCode.CONNECTION_ERROR;
                    break;

                // 查询超时
                case '57014':
                    message = '操作时间过长，请重新尝试';
                    errorCode = ErrorCode.TIMEOUT_ERROR;
                    break;
            }
        }

        // MySQL错误处理
        if (error.errno) {
            switch (error.errno) {
                // 唯一约束违反
                case 1062:
                    message = '该信息已存在，请勿重复添加';
                    errorCode = ErrorCode.UNIQUE_VIOLATION;
                    break;

                // 外键约束违反
                case 1452:
                case 1451:
                    message = '相关数据不存在，请检查后重试';
                    errorCode = ErrorCode.FOREIGN_KEY_ERROR;
                    break;

                // 非空约束违反
                case 1048:
                    message = '必填信息不能为空，请完整填写';
                    errorCode = ErrorCode.NOT_NULL_VIOLATION;
                    break;

                // 连接错误
                case 1040:
                case 1042:
                case 1043:
                    message = '系统暂时无法连接，请稍后重试';
                    errorCode = ErrorCode.CONNECTION_ERROR;
                    break;
            }
        }

        // 如果有更具体的错误消息，使用它
        if (error.message && typeof error.message === 'string') {
            details.message = error.message;
        }
    }

    return new DatabaseException(message, errorCode, details);
}
