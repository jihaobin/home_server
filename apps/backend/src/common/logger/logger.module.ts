import { DynamicModule, Global, Module, Provider, Type } from "@nestjs/common";

import { AppLoggerService } from "./app-logger.service";
import { LoggerOptions } from "./logger.interface";
import { LOGGER_OPTIONS } from "./logger.provider";

@Global()
@Module({})
export class LoggerModule {
	/**
	 * 注册日志模块
	 * @param options 日志配置选项
	 * @returns 动态模块
	 */
	static forRoot(options: LoggerOptions = {}): DynamicModule {
		const loggerOptionsProvider: Provider = {
			provide: LOGGER_OPTIONS,
			useValue: options,
		};

		return {
			module: LoggerModule,
			providers: [loggerOptionsProvider, AppLoggerService],
			exports: [AppLoggerService],
		};
	}

	/**
	 * 异步注册日志模块
	 * @param options 日志配置提供者工厂
	 * @returns 动态模块
	 */
	static forRootAsync(options: {
		useFactory: (...args: unknown[]) => LoggerOptions | Promise<LoggerOptions>;
		inject?: Array<Type<unknown> | string | symbol>;
	}): DynamicModule {
		const loggerOptionsProvider: Provider = {
			provide: LOGGER_OPTIONS,
			useFactory: options.useFactory,
			inject: options.inject || [],
		};

		return {
			module: LoggerModule,
			providers: [loggerOptionsProvider, AppLoggerService],
			exports: [AppLoggerService],
		};
	}
}
