import * as fs from "fs";
import * as path from "path";

import * as winston from "winston";

import { LogLevel } from "../logger.constants";
import { FileTransportOptions } from "../logger.interface";

/**
 * 创建文件日志传输器
 * @param options 文件传输器选项
 * @returns Winston文件传输器
 */
export const createFileTransport = (
	options: FileTransportOptions,
): winston.transport => {
	const {
		filename,
		level = LogLevel.INFO,
		maxSize = "20m",
		maxFiles = 5,
		zippedArchive = false,
	} = options;

	// 确保日志目录存在
	const dirname = path.dirname(filename);
	if (!fs.existsSync(dirname)) {
		fs.mkdirSync(dirname, { recursive: true });
	}

	return new winston.transports.File({
		filename,
		level,
		maxsize: parseFileSize(maxSize),
		maxFiles,
		zippedArchive,
	});
};

/**
 * 解析文件大小字符串为字节数
 * @param size 文件大小字符串，如 '20m', '1g'
 * @returns 字节数
 */
function parseFileSize(size: string): number {
	const units = {
		b: 1,
		k: 1024,
		m: 1024 * 1024,
		g: 1024 * 1024 * 1024,
	};

	const match = size.match(/^(\d+)([bkmg])$/i);
	if (!match) {
		return 20 * 1024 * 1024; // 默认20MB
	}

	const value = parseInt(match[1], 10);
	const unit = match[2].toLowerCase();

	return value * units[unit];
}
