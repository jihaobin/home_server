import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import type {
    FavoritePersonnelListItem,
    ListFavoritePersonnelQuery,
    FavoritePersonnelListResponse,
    PersonnelFavoriteMutationResponse,
} from '@repo/types';
import { FilesService } from '../files/files.service';
import { FollowRepository } from './follow.repository';

@Injectable()
export class FollowService {
    private readonly logger = new Logger(FollowService.name);

    constructor(
        private readonly repository: FollowRepository,
        private readonly filesService: FilesService,
    ) {}

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

    async favoritePersonnel(
        userId: string,
        personnelId: string,
    ): Promise<PersonnelFavoriteMutationResponse> {
        const normalizedPersonnelId = this.normalizePersonnelId(personnelId);

        this.ensureNotSelf(userId, normalizedPersonnelId);
        await this.ensureFavoritablePersonnelExists(normalizedPersonnelId);

        await this.repository.createFavorite(userId, normalizedPersonnelId);

        return await this.getPersonnelFavoriteSummary(
            normalizedPersonnelId,
            userId,
        );
    }

    async unfavoritePersonnel(
        userId: string,
        personnelId: string,
    ): Promise<PersonnelFavoriteMutationResponse> {
        const normalizedPersonnelId = this.normalizePersonnelId(personnelId);

        this.ensureNotSelf(userId, normalizedPersonnelId);
        await this.ensurePersonnelExists(normalizedPersonnelId);

        await this.repository.deleteFavorite(userId, normalizedPersonnelId);

        return await this.getPersonnelFavoriteSummary(
            normalizedPersonnelId,
            userId,
        );
    }

    async listFavoritePersonnel(
        userId: string,
        query: Partial<ListFavoritePersonnelQuery> = {},
    ): Promise<FavoritePersonnelListResponse> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const { items, total } = await this.repository.listFavoritePersonnel(
            userId,
            page,
            pageSize,
        );
        const itemsWithAvatar = await this.resolveFavoritePersonnelAvatar(items);

        return {
            items: itemsWithAvatar,
            page,
            pageSize,
            total,
            hasMore: page * pageSize < total,
        };
    }

    private ensureNotSelf(userId: string, personnelId: string) {
        if (userId === personnelId) {
            throw new BadRequestException('不能收藏自己');
        }
    }

    private normalizePersonnelId(personnelId: string): string {
        const normalizedPersonnelId = personnelId.trim();

        if (!normalizedPersonnelId) {
            throw new BadRequestException('personnelId 不能为空');
        }

        return normalizedPersonnelId;
    }

    private async ensureFavoritablePersonnelExists(personnelId: string) {
        const exists =
            await this.repository.ensureFavoritablePersonnelExists(personnelId);

        if (!exists) {
            throw new NotFoundException('服务人员不存在');
        }
    }

    private async ensurePersonnelExists(personnelId: string) {
        const exists = await this.repository.ensurePersonnelExists(personnelId);

        if (!exists) {
            throw new NotFoundException('服务人员不存在');
        }
    }

    private async resolveFavoritePersonnelAvatar(
        items: FavoritePersonnelListItem[],
    ): Promise<FavoritePersonnelListItem[]> {
        if (!items.length) {
            return items;
        }

        const isHttpUrl = (value: string) =>
            value.startsWith('http://') || value.startsWith('https://');

        const avatarIdentifiers = Array.from(
            new Set(
                items
                    .map((item) => (item.avatarUrl ?? '').trim())
                    .filter((id) => Boolean(id) && !isHttpUrl(id)),
            ),
        );

        const avatarInfoMap = new Map<
            string,
            { url: string; blurhash: string | null }
        >();

        await Promise.all(
            avatarIdentifiers.map(async (identifier) => {
                try {
                    const info =
                        await this.filesService.getFileAccessInfo(identifier);

                    avatarInfoMap.set(identifier, {
                        url: info.fileUrl,
                        blurhash: info.blurhash ?? null,
                    });
                } catch (error) {
                    this.logger.warn(
                        `收藏列表头像解析失败: ${identifier} - ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                }
            }),
        );

        return items.map((item) => {
            const rawAvatar = (item.avatarUrl ?? '').trim();

            if (!rawAvatar) {
                return {
                    ...item,
                    avatarUrl: null,
                    avatarBlurhash: item.avatarBlurhash ?? null,
                };
            }

            if (isHttpUrl(rawAvatar)) {
                return {
                    ...item,
                    avatarUrl: rawAvatar,
                    avatarBlurhash: item.avatarBlurhash ?? null,
                };
            }

            const avatar = avatarInfoMap.get(rawAvatar);

            return {
                ...item,
                avatarUrl: avatar?.url ?? null,
                avatarBlurhash: avatar?.blurhash ?? item.avatarBlurhash ?? null,
            };
        });
    }
}
