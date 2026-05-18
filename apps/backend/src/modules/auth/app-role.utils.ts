import type { UserRole } from '@repo/types';
import { normalizeUserRoles } from './rbac.utils';

export type AuthClientApp = 'mobile-user' | 'mobile-worker';

export function getRequiredRoleForAuthApp(app: AuthClientApp): UserRole {
    return app === 'mobile-worker' ? 'service_personnel' : 'customer';
}

export function mergeRequiredRoleForAuthApp(
    rawRoles: string[] | string | null | undefined,
    app: AuthClientApp,
): UserRole[] {
    const requiredRole = getRequiredRoleForAuthApp(app);
    const roles = normalizeUserRoles(rawRoles ?? undefined);

    if (roles.includes(requiredRole)) {
        return roles;
    }

    return [...roles, requiredRole];
}
