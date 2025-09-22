import { Global, Module, OnModuleInit } from "@nestjs/common";

import { DB } from "./database.provider";
import db, { connect, setLogWriter } from "./db";
import { AppLoggerService } from "../logger";

@Global()
@Module({
	providers: [
		{
			provide: DB,
			useFactory: async (logger: AppLoggerService) => {
				// 配置共享库的日志处理器
				setLogWriter({
					write: (message: string) => logger.log(message, "Database"),
					error: (message: string) => logger.error(message, "Database"),
				});

				try {
					await connect();
					logger.log("数据库连接成功", "DatabaseModule");
					return db;
				} catch (error: unknown) {
					logger.error(
						"数据库连接失败:",
						error instanceof Error ? error.message : String(error as string),
						"DatabaseModule",
					);
					throw error;
				}
			},
			inject: [AppLoggerService],
		},
	],
	exports: [DB],
})
export default class DatabaseModule implements OnModuleInit {
	constructor(private readonly logger: AppLoggerService) {
		this.logger.setContext("DatabaseModule");
	}

	async onModuleInit() {
		this.logger.log("初始化数据库模块...");
		try {
			await connect();
			this.logger.log("数据库连接测试成功");
		} catch (error: unknown) {
			let errorMessage = "未知错误";
			if (error instanceof Error) {
				errorMessage = error.message;
			} else if (typeof error === "string") {
				errorMessage = error;
			} else if (error !== null && typeof error === "object") {
				try {
					errorMessage = JSON.stringify(error);
				} catch {
					errorMessage = "无法序列化的对象错误";
				}
			}

			this.logger.error("数据库连接测试失败:", errorMessage);
			throw error;
		}
	}
}
