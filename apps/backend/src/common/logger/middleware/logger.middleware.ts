import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

import { AppLoggerService } from "../app-logger.service";

/**
 * HTTP请求日志中间件
 * 记录所有HTTP请求的详情
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
	constructor(private readonly logger: AppLoggerService) {
		this.logger.setContext("HTTP");
	}

	/**
	 * 中间件处理函数
	 * @param req HTTP请求对象
	 * @param res HTTP响应对象
	 * @param next 下一个中间件函数
	 */
	use(req: Request, res: Response, next: NextFunction) {
		const { method, originalUrl, ip } = req;
		const userAgent = req.get("user-agent") || "";

		const startTime = Date.now();

		// 请求开始日志
		this.logger.http(`${method} ${originalUrl} - ${ip} - ${userAgent}`);

		// 响应完成后记录状态和处理时间
		res.on("finish", () => {
			const { statusCode } = res;
			const contentLength = res.get("content-length") || 0;
			const processingTime = Date.now() - startTime;

			const message = `${method} ${originalUrl} ${statusCode} ${contentLength} - ${processingTime}ms`;

			if (statusCode >= 500) {
				this.logger.error(message);
			} else if (statusCode >= 400) {
				this.logger.warn(message);
			} else {
				this.logger.http(message);
			}
		});

		next();
	}
}
