import { Injectable } from '@nestjs/common';
import type {
    HomeBaseResponse,
    HomeQuery,
    HomeRecommendationsResponse,
    HomeResponse,
} from '@repo/types';
import { HomeRepository } from './home.repository';
import { ServiceService } from '../service/service.service';

@Injectable()
export class HomeService {
    constructor(
        private readonly homeRepository: HomeRepository,
        private readonly serviceService: ServiceService,
    ) {}

    async getHome(
        userId: string | undefined,
        query: HomeQuery,
    ): Promise<HomeResponse> {
        // 聚合接口：为兼容旧客户端，继续返回 base + recommendations。
        // 不依赖登录态；若传入坐标则按距离优先排序，否则返回全量推荐。
        const [base, recommendations] = await Promise.all([
            this.getHomeBase(),
            this.getHomeRecommendations(query),
        ]);

        return {
            ...base,
            recommendedPersonnel: recommendations.recommendedPersonnel,
        };
    }

    async getHomeBase(): Promise<HomeBaseResponse> {
        const [opsConfig, categories] = await Promise.all([
            this.homeRepository.getOpsConfig(),
            this.serviceService.getServiceCategories(0, ''),
        ]);

        // 运营位 fileUrl 在 repo 内部已解析；这里做一次防御性清洗。
        const banners = opsConfig.banners.filter((b) => Boolean(b.imageUrl));
        const guarantees = opsConfig.guarantees.filter((g) =>
            Boolean(g.iconUrl),
        );

        return {
            banners,
            guarantees,
            promos: opsConfig.promos,
            categories,
        };
    }

    async getHomeRecommendations(
        query: HomeQuery,
    ): Promise<HomeRecommendationsResponse> {
        const { maxDistanceKm = 10, limit = 20, page = 1, lat, lng } = query;
        const normalizedPage = Math.max(1, page);
        const offset = (normalizedPage - 1) * limit;

        // 需求：当客户端未传入地址坐标时，不做位置过滤，返回全量推荐并按原优先级（去掉距离）排序。
        const recommended =
            lat !== undefined && lng !== undefined
                ? await this.homeRepository.getRecommendedPersonnelWithCenter({
                      center: [lng, lat],
                      maxDistanceKm,
                      limit,
                      offset,
                  })
                : await this.homeRepository.getRecommendedPersonnelGlobal({
                      limit,
                      offset,
                  });

        return {
            recommendedPersonnel: recommended,
            page: normalizedPage,
            limit,
            hasMore: recommended.length === limit,
            nextPage: recommended.length === limit ? normalizedPage + 1 : null,
        };
    }
}
