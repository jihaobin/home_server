import {
    Inject,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
    AdminLoginRequest,
    AdminLogoutResponse,
    AdminProfile,
    UserRole,
} from '@repo/types';
import { AUTH_INSTANCE_KEY } from '../auth/symbols';
import type { Auth } from 'better-auth/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { normalizeUserRoles } from '../auth/rbac.utils';
import type { UserSession } from '../auth/auth.guard';
import type { AdminRequestContext } from '../auth/admin-session.middleware';

type BetterAuthUser = UserSession['user'];

@Injectable()
export class AdminAuthService {
    private readonly logger = new Logger(AdminAuthService.name);

    constructor(
        @Inject(AUTH_INSTANCE_KEY)
        private readonly auth: Auth,
    ) {}

    /**
     * 管理员邮箱密码登录
     */
    async login(payload: AdminLoginRequest): Promise<{
        profile: AdminProfile;
        headers?: Headers;
    }> {
        try {
            const result = await this.auth.api.signInEmail({
                body: {
                    email: payload.email,
                    password: payload.password,
                    rememberMe: payload.rememberMe,
                },
                returnHeaders: true,
            });

            const user = result.response.user as BetterAuthUser;
            const roles = normalizeUserRoles(user.role);

            return {
                profile: this.toProfile(user, roles),
                headers: result.headers,
            };
        } catch (error) {
            const reason = this.extractErrorMessage(error);
            this.logger.warn(`管理员登录失败(${payload.email}): ${reason}`);

            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: '邮箱或密码错误，或账号无权限',
            });
        }
    }

    /**
     * 管理员退出登录
     */
    async logout(request: Request): Promise<{
        headers?: Headers;
        response: AdminLogoutResponse;
    }> {
        try {
            const result = await this.auth.api.signOut({
                headers: fromNodeHeaders(request.headers || []),
                returnHeaders: true,
            });

            return {
                headers: result.headers,
                response: {
                    success: !!result.response?.success,
                },
            };
        } catch (error) {
            const reason = this.extractErrorMessage(error);
            this.logger.warn(`管理员退出登录失败: ${reason}`);

            throw new UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: '会话已失效或未登录',
            });
        }
    }

    /**
     * 根据管理员上下文构造 Profile
     */
    getProfileFromContext(context?: AdminRequestContext): AdminProfile {
        if (!context) {
            throw new UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: '管理员未登录或会话无效',
            });
        }

        if (!context.email) {
            throw new UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: '管理员账号缺少邮箱信息',
            });
        }

        return {
            id: context.id,
            email: context.email,
            name: context.name,
            roles: context.roles,
        };
    }

    private toProfile(user: BetterAuthUser, roles: UserRole[]): AdminProfile {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            roles,
        };
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }
}
