import { Module, Global, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { HttpExceptionFilter } from './http-exception.filter';
import { LoggerModule } from '../logger/logger.module';

/**
 * 异常模块配置接口
 */
export interface ExceptionsModuleOptions {
    /**
     * 是否启用全局异常过滤器
     */
    enableGlobalFilter?: boolean;
}

/**
 * 异常模块
 * 用于全局注册和配置异常过滤器
 */
@Global()
@Module({
    imports: [LoggerModule],
    providers: [HttpExceptionFilter],
    exports: [HttpExceptionFilter],
})
export class ExceptionsModule {
    /**
     * 使用自定义配置创建异常模块
     * @param options 异常模块配置
     * @returns 动态模块
     */
    static forRoot(options: ExceptionsModuleOptions = {}) {
        const { enableGlobalFilter = true } = options;

        const providers: Provider[] = [HttpExceptionFilter];

        // 注册全局异常过滤器
        if (enableGlobalFilter) {
            providers.push({
                provide: APP_FILTER,
                useClass: HttpExceptionFilter,
            });
        }

        return {
            module: ExceptionsModule,
            imports: [LoggerModule],
            providers,
            exports: [HttpExceptionFilter],
        };
    }
}
