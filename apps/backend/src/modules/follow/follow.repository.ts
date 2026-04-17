import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { follows } from 'src/common/database/schema';

@Injectable()
export class FollowRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async countFavoritesByPersonnelId(personnelId: string): Promise<number> {
        const [row] = await this.db
            .select({
                count: sql<number>`count(*)`,
            })
            .from(follows)
            .where(eq(follows.followingId, personnelId));

        return Number(row?.count ?? 0);
    }

    async existsActiveFavorite(
        userId: string,
        personnelId: string,
    ): Promise<boolean> {
        const [row] = await this.db
            .select({
                followingId: follows.followingId,
            })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, userId),
                    eq(follows.followingId, personnelId),
                ),
            )
            .limit(1);

        return Boolean(row);
    }
}
