jest.mock('sharp', () => jest.fn());

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FollowService } from './follow.service';

describe('FollowService', () => {
    const createService = (repository: any, filesService?: any) =>
        new FollowService(
            repository,
            filesService ??
                ({
                    getFileAccessInfo: jest.fn(),
                } as any),
        );

    it('返回 favoriteCount 和 isFavorited', async () => {
        const repository = {
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(12),
            existsActiveFavorite: jest.fn().mockResolvedValue(true),
        } as any;

        const service = createService(repository);
        const result = await service.getPersonnelFavoriteSummary(
            'personnel_1',
            'user_1',
        );

        expect(result).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 12,
            isFavorited: true,
        });
    });

    it('收藏成功后返回最新状态', async () => {
        const repository = {
            ensureFavoritablePersonnelExists: jest.fn().mockResolvedValue(true),
            createFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(5),
            existsActiveFavorite: jest.fn().mockResolvedValue(true),
        } as any;

        const service = createService(repository);
        const result = await service.favoritePersonnel('user_1', 'personnel_1');

        expect(
            repository.ensureFavoritablePersonnelExists,
        ).toHaveBeenCalledWith('personnel_1');
        expect(repository.createFavorite).toHaveBeenCalledWith(
            'user_1',
            'personnel_1',
        );
        expect(result).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 5,
            isFavorited: true,
        });
    });

    it('取消收藏成功后返回最新状态', async () => {
        const repository = {
            ensurePersonnelExists: jest.fn().mockResolvedValue(true),
            deleteFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(4),
            existsActiveFavorite: jest.fn().mockResolvedValue(false),
        } as any;

        const service = createService(repository);
        const result = await service.unfavoritePersonnel(
            'user_1',
            'personnel_1',
        );

        expect(repository.ensurePersonnelExists).toHaveBeenCalledWith(
            'personnel_1',
        );
        expect(repository.deleteFavorite).toHaveBeenCalledWith(
            'user_1',
            'personnel_1',
        );
        expect(result).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 4,
            isFavorited: false,
        });
    });

    it('重复收藏幂等成功', async () => {
        const repository = {
            ensureFavoritablePersonnelExists: jest.fn().mockResolvedValue(true),
            createFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(5),
            existsActiveFavorite: jest.fn().mockResolvedValue(true),
        } as any;

        const service = createService(repository);

        const first = await service.favoritePersonnel('user_1', 'personnel_1');
        const second = await service.favoritePersonnel('user_1', 'personnel_1');

        expect(repository.createFavorite).toHaveBeenCalledTimes(2);
        expect(first).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 5,
            isFavorited: true,
        });
        expect(second).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 5,
            isFavorited: true,
        });
    });

    it('重复取消收藏幂等成功', async () => {
        const repository = {
            ensurePersonnelExists: jest.fn().mockResolvedValue(true),
            deleteFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(4),
            existsActiveFavorite: jest.fn().mockResolvedValue(false),
        } as any;

        const service = createService(repository);

        const first = await service.unfavoritePersonnel(
            'user_1',
            'personnel_1',
        );
        const second = await service.unfavoritePersonnel(
            'user_1',
            'personnel_1',
        );

        expect(repository.deleteFavorite).toHaveBeenCalledTimes(2);
        expect(first).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 4,
            isFavorited: false,
        });
        expect(second).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 4,
            isFavorited: false,
        });
    });

    it('人员下架后仍可取消收藏', async () => {
        const repository = {
            ensurePersonnelExists: jest.fn().mockResolvedValue(true),
            deleteFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(0),
            existsActiveFavorite: jest.fn().mockResolvedValue(false),
        } as any;

        const service = createService(repository);
        const result = await service.unfavoritePersonnel(
            'user_1',
            'personnel_offline',
        );

        expect(repository.ensurePersonnelExists).toHaveBeenCalledWith(
            'personnel_offline',
        );
        expect(result).toEqual({
            personnelId: 'personnel_offline',
            favoriteCount: 0,
            isFavorited: false,
        });
    });

    it('收藏自己失败', async () => {
        const repository = {} as any;
        const service = createService(repository);

        await expect(
            service.favoritePersonnel('user_self', 'user_self'),
        ).rejects.toThrow(BadRequestException);
    });

    it.each(['', '   '])('非法 personnelId=%j 时失败', async (personnelId) => {
        const repository = {
            ensureFavoritablePersonnelExists: jest.fn().mockResolvedValue(true),
        } as any;
        const service = createService(repository);

        await expect(
            service.favoritePersonnel('user_1', personnelId),
        ).rejects.toThrow(BadRequestException);
    });

    it('personnel 不存在时报 404', async () => {
        const repository = {
            ensureFavoritablePersonnelExists: jest
                .fn()
                .mockResolvedValue(false),
        } as any;
        const service = createService(repository);

        await expect(
            service.favoritePersonnel('user_1', 'personnel_missing'),
        ).rejects.toThrow(NotFoundException);
    });

    it('返回我的收藏列表并计算 hasMore', async () => {
        const filesService = {
            getFileAccessInfo: jest.fn().mockResolvedValue({
                fileUrl: 'https://cdn.example.com/avatar-1.png',
                fileName: 'avatar-1.png',
                mimeType: 'image/png',
                fileSize: 1024,
                expiresIn: 600,
                blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
            }),
        } as any;
        const repository = {
            listFavoritePersonnel: jest.fn().mockResolvedValue({
                items: [
                    {
                        personnelId: 'personnel_1',
                        personnelName: '技师 A',
                        avatarUrl: 'avatar_hash_1',
                        avatarBlurhash: null,
                        addressText: '浦东新区',
                        distanceText: '直线 850m',
                        availableTimeText: '最早可约08:30',
                        favoriteCount: 10,
                        reviewCount: 8,
                        ratingValue: 4.9,
                        yearlyOrderCount: 23,
                        primaryServiceId: 'service_1',
                        primaryPricingId: 'pricing_1',
                        primaryServiceName: '精油推拿',
                        favoritedAt: null,
                    },
                ],
                total: 3,
            }),
        } as any;

        const service = createService(repository, filesService);
        const result = await service.listFavoritePersonnel('user_1', {
            page: 1,
            pageSize: 2,
        });

        expect(repository.listFavoritePersonnel).toHaveBeenCalledWith(
            'user_1',
            1,
            2,
        );
        expect(filesService.getFileAccessInfo).toHaveBeenCalledWith(
            'avatar_hash_1',
        );
        expect(result).toEqual({
            items: [
                {
                    personnelId: 'personnel_1',
                    personnelName: '技师 A',
                    avatarUrl: 'https://cdn.example.com/avatar-1.png',
                    avatarBlurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
                    addressText: '浦东新区',
                    distanceText: '直线 850m',
                    availableTimeText: '最早可约08:30',
                    favoriteCount: 10,
                    reviewCount: 8,
                    ratingValue: 4.9,
                    yearlyOrderCount: 23,
                    primaryServiceId: 'service_1',
                    primaryPricingId: 'pricing_1',
                    primaryServiceName: '精油推拿',
                    favoritedAt: null,
                },
            ],
            page: 1,
            pageSize: 2,
            total: 3,
            hasMore: true,
        });
    });
});
