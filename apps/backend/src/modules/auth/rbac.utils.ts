import type { UserRole } from '@repo/types';

export const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];

export function normalizeUserRoles(
    rawRoles: string | string[] | undefined,
): UserRole[] {
    if (!rawRoles) {
        return [];
    }

    if (Array.isArray(rawRoles)) {
        return rawRoles.filter(Boolean) as UserRole[];
    }

    return rawRoles
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean) as UserRole[];
}

export function hasRequiredRole(
    rawRoles: string | string[] | undefined,
    requiredRoles: UserRole[],
): boolean {
    if (!requiredRoles || requiredRoles.length === 0) {
        return true;
    }

    const normalized = normalizeUserRoles(rawRoles);
    return normalized.some((role) => requiredRoles.includes(role));
}

export function hasAdminRole(rawRoles: string | string[] | undefined): boolean {
    return hasRequiredRole(rawRoles, ADMIN_ROLES);
}
