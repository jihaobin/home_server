import { DefaultLogger, LogWriter } from "drizzle-orm/logger";

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";

import { Pool } from "pg";

import * as schemas from "./schema";

if (!process.env.DATABASE_URI) {
	throw new Error("DATABASE_URI 环境变量未配置");
}

// 扩展日志接口

interface EnhancedLogWriter extends LogWriter {
	error: (message: string) => void;
}

// 默认日志处理器，允许外部注入

let logWriter: EnhancedLogWriter = {
	write: (message: string) => console.info(message),
	error: (message: string) => console.error(message),
};

// 可以由外部注入的日志处理器

export function setLogWriter(writer: EnhancedLogWriter): void {
	logWriter = writer;
}

const connection = new Pool({
	connectionString: process.env.DATABASE_URI,
	max: 20, // 最大连接数
	idleTimeoutMillis: 30000, // 连接最大空闲时间
	connectionTimeoutMillis: 2000, // 连接超时时间
});

const db = drizzle(connection, {
	logger: new DefaultLogger({ writer: logWriter }),
	schema: schemas,
	casing: "snake_case",
});

const connect = async () => {
	if (!connection) {
		throw new Error("数据库连接未初始化，这可能是因为当前不是服务器环境");
	}

	try {
		const client = await connection.connect();
		logWriter.write("数据库连接成功");
		client.release();

		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWriter.error(`数据库连接失败: ${errorMessage}`);
		throw error;
	}
};

export type DbType = NodePgDatabase<typeof schemas>;

export { connect };

export default db;
