import { Injectable } from '@nestjs/common';
import { FollowRepository } from './follow.repository';

@Injectable()
export class FollowService {
    constructor(private readonly repository: FollowRepository) {}

    async getPersonnelFavoriteSummary(personnelId: string, userId?: string) {
        const [favoriteCount, isFavorited] = await Promise.all([
            this.repository.countFavoritesByPersonnelId(personnelId),
            userId
                ? this.repository.existsActiveFavorite(userId, personnelId)
                : Promise.resolve(false),
        ]);

        return {
            personnelId,
            favoriteCount,
            isFavorited,
        };
    }
}
