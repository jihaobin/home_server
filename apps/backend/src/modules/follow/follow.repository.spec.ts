import { FollowRepository } from './follow.repository';

describe('FollowRepository', () => {
    const createDrizzleDbMock = (rows: any[]) => {
        const genericBuilder: any = {
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            as: jest.fn().mockReturnValue({}),
            innerJoin: jest.fn().mockReturnThis(),
            leftJoinLateral: jest.fn().mockReturnThis(),
            leftJoin: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            offset: jest.fn().mockResolvedValue(rows),
        };

        return {
            select: jest.fn().mockReturnValue(genericBuilder),
            $with: jest.fn().mockReturnValue({
                as: jest.fn().mockReturnValue({}),
            }),
            with: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue(genericBuilder),
            }),
        } as any;
    };

    it('execute 返回空 rows 时回退 countFavoritesByUserId 作为 total', async () => {
        const db = createDrizzleDbMock([]);
        const repository = new FollowRepository(db);
        const countFavoritesByUserIdSpy = jest
            .spyOn(repository, 'countFavoritesByUserId')
            .mockResolvedValue(7);

        const result = await repository.listFavoritePersonnel('user_1', 3, 10);

        expect(countFavoritesByUserIdSpy).toHaveBeenCalledWith('user_1');
        expect(result).toEqual({
            items: [],
            total: 7,
        });
    });

    it('execute 返回有 rows 时正确映射 items 且 total 取 totalCount', async () => {
        const db = createDrizzleDbMock([
            {
                personnelId: 'personnel_1',
                personnelName: '技师 A',
                avatarIdentifier: 'avatar_hash_1',
                addressText: '浦东新区',
                workStartTime: '08:30:00',
                distanceKm: '1.24',
                totalCount: '3',
                favoriteCount: '10',
                reviewCount: '8',
                ratingValue: '4.9',
                yearlyOrderCount: '23',
                primaryServiceId: 'service_1',
                primaryPricingId: 'pricing_1',
                primaryServiceName: '精油推拿',
            },
        ]);
        const repository = new FollowRepository(db);
        const countFavoritesByUserIdSpy = jest.spyOn(
            repository,
            'countFavoritesByUserId',
        );

        const result = await repository.listFavoritePersonnel('user_1', 1, 10);

        expect(countFavoritesByUserIdSpy).not.toHaveBeenCalled();
        expect(result).toEqual({
            items: [
                {
                    personnelId: 'personnel_1',
                    personnelName: '技师 A',
                    avatarUrl: 'avatar_hash_1',
                    avatarBlurhash: null,
                    addressText: '浦东新区',
                    distanceText: '直线 1.2km',
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
        });
    });
});
