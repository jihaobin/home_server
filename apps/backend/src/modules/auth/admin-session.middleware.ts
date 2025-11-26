import {
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NestMiddleware,
    UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AUTH_INSTANCE_KEY } from './symbols';
import type { Auth } from 'better-auth/auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { UserRole } from '@repo/types';
import type { UserSession } from './auth.guard';
import { ADMIN_ROLES, hasAdminRole, normalizeUserRoles } from './rbac.utils';

export type AdminRequestContext = {
    id: string;
    email?: string;
    name?: string;
    roles: UserRole[];
};

declare module 'express' {
    interface Request {
        admin?: AdminRequestContext;
    }
}

@Injectable()
export class AdminSessionMiddleware implements NestMiddleware {
    private readonly logger = new Logger(AdminSessionMiddleware.name);

    constructor(
        @Inject(AUTH_INSTANCE_KEY)
        private readonly auth: Auth,
    ) {}

    async use(req: Request, _res: Response, next: NextFunction) {
        const session = (await this.auth.api.getSession({
            headers: fromNodeHeaders(req.headers || []),
        })) as UserSession | null;

        if (!session || !session.user) {
            throw new UnauthorizedException({
                code: 'UNAUTHORIZED',

                message: '管理员未登录或会话已失效',
            });
        }

        if (!hasAdminRole(session.user.role)) {
            this.logger.warn(
                `用户 ${session.user.id} 尝试访问管理员接口但权限不足`,
            );

            throw new ForbiddenException({
                code: 'FORBIDDEN',
                message: '当前用户无权访问管理端接口',
            });
        }

        const normalizedRoles = normalizeUserRoles(session.user.role);

        req.session = session;
        req.user = session.user;
        req.admin = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            roles: normalizedRoles,
        };

        next();
    }
}

export const adminRouteMatcher = {
    path: 'admin/(.*)',
};

export const ADMIN_ALLOWED_ROLES = ADMIN_ROLES;
