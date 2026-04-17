import { FollowService } from './follow.service';

describe('FollowService', () => {
    it('返回 favoriteCount 和 isFavorited', async () => {
        const repository = {
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(12),
            existsActiveFavorite: jest.fn().mockResolvedValue(true),
        } as any;

        const service = new FollowService(repository);
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
});
