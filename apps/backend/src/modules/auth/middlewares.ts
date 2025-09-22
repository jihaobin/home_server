import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import * as express from "express";

@Injectable()
export class SkipBodyParsingMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction) {
		console.log("url", req.url, req.baseUrl, req.originalUrl);
		// 跳过nest自带的json解析操作，因为beatter-auth需要访问原始的request请求对象
		if (req.baseUrl.startsWith("/api/auth")) {
			next();
			return;
		}

		express.json()(req, res, (err) => {
			if (err) {
				next(err);
				return;
			}
			express.urlencoded({ extended: true })(req, res, next);
		});
	}
}
