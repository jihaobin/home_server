import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { CustomDecorator, ExecutionContext } from '@nestjs/common';
import { AFTER_HOOK_KEY, BEFORE_HOOK_KEY, HOOK_KEY } from './symbols';
import { UserRole } from '@repo/types';

/**
 * Marks a route as public, allowing unauthenticated access.
 * When applied to a controller method, the AuthGuard will skip authentication checks.
 */
export const Public = () => SetMetadata('PUBLIC', true);

/**
 * Marks a route as having optional authentication.
 * When applied to a controller method, the AuthGuard will allow the request to proceed
 * regardless of authentication status.
 *
 * **Behavior:**
 * - If user is authenticated: `req.user` and `req.session` will be populated
 * - If user is not authenticated: `req.user` and `req.session` will be undefined
 * - Request will proceed successfully in both cases
 *
 * **Use cases:**
 * - Public APIs that provide additional features for authenticated users
 * - Search/browse endpoints that can optionally personalize results
 * - Content that's accessible to all but tracks authenticated users
 *
 * @example
 * ```typescript
 * @Get('search')
 * @UseGuards(AuthGuard)
 * @Optional()
 * async search(@Req() req: Request) {
 *   // req.user might be undefined
 *   const userId = req.user?.id; // Safe to access
 *   // ... filter results based on userId if available
 * }
 * ```
 */
export const AuthOptional = () => SetMetadata('OPTIONAL', true);

/**
 * Specifies the roles required to access a route or controller.
 * The AuthGuard will check if the authenticated user's roles
 * include at least one of the specified roles.
 * @param roles - The roles required for access
 */
export const Roles = (roles: UserRole[]): CustomDecorator =>
    SetMetadata('ROLES', roles);

/**
 * Parameter decorator that extracts the user session from the request.
 * Provides easy access to the authenticated user's session data in controller methods.
 */
export const Session = createParamDecorator(
    (_data: unknown, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        return request.session;
    },
);

/**
 * Registers a method to be executed before a specific auth route is processed.
 * @param path - The auth route path that triggers this hook (must start with '/')
 */
export const BeforeHook = (path: `/${string}`) =>
    SetMetadata(BEFORE_HOOK_KEY, path);

/**
 * Registers a method to be executed after a specific auth route is processed.
 * @param path - The auth route path that triggers this hook (must start with '/')
 */
export const AfterHook = (path: `/${string}`) =>
    SetMetadata(AFTER_HOOK_KEY, path);

/**
 * Class decorator that marks a provider as containing hook methods.
 * Must be applied to classes that use BeforeHook or AfterHook decorators.
 */
export const Hook = () => SetMetadata(HOOK_KEY, true);
