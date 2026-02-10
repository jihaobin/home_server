import { Injectable } from '@nestjs/common';
import type {
    HomeBaseResponse,
    HomeQuery,
    HomeRecommendationsResponse,
    HomeResponse,
    ServiceCategoryTree,
    Services,
} from '@repo/types';
import { HomeRepository } from './home.repository';
import { ServiceService } from '../service/service.service';

type HomeQueryWithCategoryId = HomeQuery & {
    categoryId?: string;
};

@Injectable()
export class HomeService {
    constructor(
        private readonly homeRepository: HomeRepository,
        private readonly serviceService: ServiceService,
    ) {}

    async getHome(
        userId: string | undefined,
        query: HomeQueryWithCategoryId,
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

        const categoryTree = categories as unknown as ServiceCategoryTree[];

        // 运营位 fileUrl 在 repo 内部已解析；这里做一次防御性清洗。
        const banners = opsConfig.banners.filter((b) => Boolean(b.imageUrl));
        const guarantees = opsConfig.guarantees.filter((g) =>
            Boolean(g.iconUrl),
        );

        return {
            banners,
            guarantees,
            promos: opsConfig.promos,
            categories: categoryTree,
        };
    }

    async getHomeMoreServices(): Promise<{
        categories: ServiceCategoryTree[];
    }> {
        const categories = (await this.serviceService.getServiceCategories(
            0,
            '',
        )) as unknown as ServiceCategoryTree[];

        const collectCategoryIds = (
            nodes: readonly ServiceCategoryTree[],
            acc: Set<string>,
        ) => {
            for (const node of nodes) {
                acc.add(node.id);
                if (Array.isArray(node.children) && node.children.length > 0) {
                    collectCategoryIds(node.children, acc);
                }
            }
        };

        const categoryIds = new Set<string>();
        collectCategoryIds(categories, categoryIds);

        const services =
            await this.serviceService.getActiveServicesByCategoryIds(
                Array.from(categoryIds),
            );

        const servicesByCategoryId = new Map<string, Services[]>();
        for (const service of services) {
            const key = service.categoryId;
            const existing = servicesByCategoryId.get(key);
            if (existing) {
                existing.push(service);
            } else {
                servicesByCategoryId.set(key, [service]);
            }
        }

        const attachServices = (nodes: readonly ServiceCategoryTree[]) =>
            nodes.map((node) => {
                const nextChildren = Array.isArray(node.children)
                    ? attachServices(node.children)
                    : node.children;
                const nodeServices = servicesByCategoryId.get(node.id) ?? [];

                return {
                    ...node,
                    children: nextChildren as unknown as ServiceCategoryTree[],
                    services: nodeServices,
                };
            });

        return {
            categories: attachServices(categories),
        };
    }

    async getHomeRecommendations(
        query: HomeQueryWithCategoryId,
    ): Promise<HomeRecommendationsResponse> {
        const {
            maxDistanceKm = 10,
            limit = 20,
            page = 1,
            lat,
            lng,
            categoryId,
        } = query;
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
                      categoryId,
                  })
                : await this.homeRepository.getRecommendedPersonnelGlobal({
                      limit,
                      offset,
                      categoryId,
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
