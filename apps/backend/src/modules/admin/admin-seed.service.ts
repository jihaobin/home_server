import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Auth } from 'better-auth/auth';
import { AUTH_INSTANCE_KEY } from '../auth/symbols';
import db from 'src/common/database/db';
import { users } from 'src/common/database/schema/auth-user';
import { normalizeUserRoles } from '../auth/rbac.utils';

@Injectable()
export class AdminSeedService implements OnModuleInit {
    private readonly logger = new Logger(AdminSeedService.name);

    constructor(
        @Inject(AUTH_INSTANCE_KEY)
        private readonly auth: Auth,
    ) {}

    async onModuleInit() {
        const email = process.env.ADMIN_SEED_EMAIL;
        const password = process.env.ADMIN_SEED_PASSWORD;
        const name = process.env.ADMIN_SEED_NAME ?? 'Super Admin';

        if (!email || !password) {
            this.logger.debug(
                'ADMIN_SEED_EMAIL 或 ADMIN_SEED_PASSWORD 未设置，跳过管理员初始化',
            );
            return;
        }

        const existing = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!existing) {
            this.logger.log(`未找到管理员账号 ${email}，尝试创建 super_admin`);

            try {
                const result = await this.auth.api.signUpEmail({
                    body: {
                        email,
                        password,
                        name,
                    },
                });

                const userId = result.user.id;

                await db
                    .update(users)
                    .set({
                        role: ['super_admin'],
                        emailVerified: true,
                    })
                    .where(eq(users.id, userId));

                this.logger.log(`管理员账号 ${email} 创建成功`);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                this.logger.error(`创建管理员账号失败: ${message}`);
                throw error;
            }

            return;
        }

        const existingRoles = normalizeUserRoles(existing.role ?? undefined);
        if (
            existingRoles.includes('admin') ||
            existingRoles.includes('super_admin')
        ) {
            this.logger.log(`管理员账号 ${email} 已存在，跳过初始化`);
            return;
        }

        await db
            .update(users)
            .set({ role: ['super_admin'] })
            .where(eq(users.id, existing.id));
        this.logger.log(`已将现有账号 ${email} 提升为 super_admin`);
    }
}
