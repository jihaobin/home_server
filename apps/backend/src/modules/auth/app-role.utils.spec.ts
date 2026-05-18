import { mergeRequiredRoleForAuthApp } from './app-role.utils';

describe('auth app role utils', () => {
    it('服务人员端登录已有 customer 用户时补齐 service_personnel 角色', () => {
        expect(
            mergeRequiredRoleForAuthApp(['customer'], 'mobile-worker'),
        ).toEqual(['customer', 'service_personnel']);
    });

    it('用户端登录已有 service_personnel 用户时补齐 customer 角色', () => {
        expect(
            mergeRequiredRoleForAuthApp(['service_personnel'], 'mobile-user'),
        ).toEqual(['service_personnel', 'customer']);
    });

    it('已有目标角色时保持角色列表不变', () => {
        expect(
            mergeRequiredRoleForAuthApp(
                ['customer', 'service_personnel'],
                'mobile-worker',
            ),
        ).toEqual(['customer', 'service_personnel']);
    });
});
