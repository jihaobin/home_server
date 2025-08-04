import { Module } from '@nestjs/common';
import {
    LogFormatterType,
    LoggerModule,
    LogLevel,
    LogTransportType,
} from './common/logger';
import DatabaseModule from './common/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CacheModule, CacheType } from './common/cache';
import { ExceptionsModule } from './common/exceptions';
import { InterceptorsModule } from './common/interceptors';
import { ModulesModule } from './modules/modules.module';

@Module({
    imports: [
        // 全局模块
        DatabaseModule,
        // 配置模块
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        // 日志模块
        LoggerModule.forRoot({
            appName: 'cow-course-api',
            isDevelopment: process.env.NODE_ENV !== 'production',
            defaultLevel:
                process.env.NODE_ENV !== 'production'
                    ? LogLevel.DEBUG
                    : LogLevel.INFO,
            formatter: {
                type:
                    process.env.NODE_ENV !== 'production'
                        ? LogFormatterType.DETAILED
                        : LogFormatterType.JSON,
                timestamp: true,
                colors: process.env.NODE_ENV !== 'production',
            },
            transports: [
                {
                    type: LogTransportType.ROTATE_FILE,
                    options: {
                        level: LogLevel.DEBUG,
                        colors: process.env.NODE_ENV !== 'production',
                    },
                },
            ],
        }),
        // 缓存模块
        // 缓存模块 - 使用redis
        CacheModule.registerAsync({
            type: CacheType.IOREDIS,
            redisOptions: {
                host: 'localhost',
                port: 6379,
                db: 0,
            },
        }),
        // 异常过滤器模块
        ExceptionsModule.forRoot({
            enableGlobalFilter: true,
        }),

        // 拦截器模块
        InterceptorsModule.forRoot({
            enableTransform: true,
            enableTimeout: false,
            timeout: 30000,
            defaultSuccessMessage: '操作成功',
        }),
        // 认证模块
        AuthModule.forRoot({
            disableExceptionFilter: true,
        }),

        // 业务模块
        ModulesModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
