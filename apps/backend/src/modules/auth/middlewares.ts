import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as express from 'express';

export type RequestWithRawBody = Request & {
    rawBody?: string;
};

export function assignRawBody(req: RequestWithRawBody, buf: Buffer) {
    if (!req.rawBody && buf.length > 0) {
        req.rawBody = buf.toString('utf8');
    }
}

@Injectable()
export class SkipBodyParsingMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // 跳过nest自带的json解析操作，因为beatter-auth需要访问原始的request请求对象
        if (req.baseUrl.startsWith('/api/auth')) {
            next();
            return;
        }

        const request = req as RequestWithRawBody;
        const captureRawBody = (
            currentReq: Request,
            _res: Response,
            buf: Buffer,
        ) => {
            assignRawBody(currentReq as RequestWithRawBody, buf);
        };

        express.json({ verify: captureRawBody })(request, res, (err) => {
            if (err) {
                next(err);
                return;
            }
            express.urlencoded({
                extended: true,
                verify: captureRawBody,
            })(request, res, next);
        });
    }
}
