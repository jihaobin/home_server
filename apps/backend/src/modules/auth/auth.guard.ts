import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
    Inject,
    Injectable,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { getSession } from 'better-auth/api';
import type { Auth } from 'better-auth/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { AUTH_INSTANCE_KEY } from './symbols';
import db from 'src/common/database/db';
import * as schema from 'src/common/database/schema';
import { eq } from 'drizzle-orm';

/**
 * Type representing a valid user session after authentication
 * Excludes null and undefined values from the session return type
 */
export type BaseUserSession = NonNullable<
    Awaited<ReturnType<ReturnType<typeof getSession>>>
>;

export type UserSession = BaseUserSession & {
    user: BaseUserSession['user'] & {
        role?: string | string[];
    };
};

declare module 'express' {
    interface Request {
        session: UserSession;
        user: UserSession['user'];
    }
}

/**
 * NestJS guard that handles authentication for protected routes
 * Can be configured with decorators to modify authentication behavior:
 * - @Public(): Bypasses authentication entirely
 * - @Optional(): Allows both authenticated and unauthenticated access (attaches user info if available)
 */
@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(
        @Inject(Reflector)
        private readonly reflector: Reflector,
        @Inject(AUTH_INSTANCE_KEY)
        private readonly auth: Auth,
    ) {}

    /**
     * Validates if the current request is authenticated
     * Attaches session and user information to the request object
     * @param context - The execution context of the current request
     * @returns True if the request is authorized to proceed, throws an error otherwise
     *
     * Supports three authentication modes:
     * - Default (strict): Requires authentication, throws 401 if not authenticated
     * - @Public(): Bypasses authentication entirely
     * - @Optional(): Allows both authenticated and unauthenticated requests
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // Check if the route is marked as public
        const isPublic = this.reflector.get('PUBLIC', context.getHandler());
        if (isPublic) return true;

        // Check if the route allows optional authentication
        const isOptionalAuth = this.reflector.get(
            'OPTIONAL',
            context.getHandler(),
        );

        // Get session information
        const session: UserSession | null = await this.auth.api.getSession({
            headers: fromNodeHeaders(
                request.headers || request?.handshake?.headers || [],
            ),
        });

        // If authentication is optional, allow the request regardless of session
        // But still attach session/user info if available
        if (isOptionalAuth) {
            if (session && session.user) {
                request.session = session;
                request.user = session.user;
            }
            return true;
        }

        // For non-optional routes, require authentication
        if (!session || !session.user) {
            throw new UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: '当前用户未登录或者不存在',
            });
        }

        request.session = session;
        request.user = session.user; // useful for observability tools like Sentry

        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            'ROLES',
            [context.getHandler(), context.getClass()],
        );

        if (requiredRoles && requiredRoles.length > 0) {
            const userRole = session.user.role;
            let hasRole = false;
            if (Array.isArray(userRole)) {
                hasRole = userRole.some((role) => requiredRoles.includes(role));
            } else if (typeof userRole === 'string') {
                hasRole = userRole
                    .split(',')
                    .some((role) => requiredRoles.includes(role));
            }

            if (!hasRole) {
                throw new UnauthorizedException({
                    code: 'FORBIDDEN',
                    message: '当前用户没有权限访问该资源',
                });
            }
        }

        return true;
    }
}
