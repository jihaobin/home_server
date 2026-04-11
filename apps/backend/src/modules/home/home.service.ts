import { Injectable } from '@nestjs/common';
import type {
    HomeBaseResponse,
    HomeQuery,
    HomeRecommendationsResponse,
    HomeResponse,
    HomeSearchQuery,
    HomeSearchResponse,
    HomeSearchSuggestionResponse,
    HomeSearchSuggestionsQuery,
    ServiceCategoryTree,
    Services,
} from '@repo/types';
import { HomeRepository } from './home.repository';
import { ServiceService } from '../service/service.service';
import { ServicePersonnelService } from '../service-personnel/service-personnel.service';

type HomeQueryWithCategoryId = HomeQuery & {
    categoryId?: string;
};

@Injectable()
export class HomeService {
    constructor(
        private readonly homeRepository: HomeRepository,
        private readonly serviceService: ServiceService,
        private readonly servicePersonnelService: ServicePersonnelService,
    ) {}

    private normalizeSearchKeyword(keyword: string) {
        return keyword.trim().replace(/\s+/g, ' ');
    }

    async getHome(
        userId: string | undefined,
        query: HomeQueryWithCategoryId,
    ): Promise<HomeResponse> {
        // 聚合接口：为兼容旧客户端，继续返回 base + recommendations。
        // 不依赖登录态；若传入坐标则按距离优先排序，否则返回全量推荐。
        const [base, recommendations] = await Promise.all([
            this.getHomeBase(),
            this.getHomeRecommendations(userId, query),
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

    async searchSuggestions(
        query: HomeSearchSuggestionsQuery,
    ): Promise<HomeSearchSuggestionResponse> {
        const keyword = this.normalizeSearchKeyword(query.keyword);
        const limit = query.limit ?? 10;

        const [personnelSuggestions, serviceSuggestions] = await Promise.all([
            this.servicePersonnelService.findSearchPersonnelSuggestions(
                keyword,
                Math.min(limit, 5),
            ),
            this.serviceService.searchActiveServicesByKeyword(
                keyword,
                Math.min(limit, 5),
            ),
        ]);

        return {
            suggestions: [
                ...personnelSuggestions.map((item) => ({
                    type: 'personnel' as const,
                    label: item.name?.trim() || '服务人员',
                    personnelId: item.id,
                })),
                ...serviceSuggestions.map((item) => ({
                    type: 'service' as const,
                    label: item.name,
                    serviceId: item.id,
                })),
            ].slice(0, limit),
        };
    }

    async search(
        userId: string | undefined,
        query: HomeSearchQuery,
    ): Promise<HomeSearchResponse> {
        const keyword = this.normalizeSearchKeyword(query.keyword);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        if (query.personnelId) {
            const summary =
                await this.servicePersonnelService.getPersonnelServicesSummary(
                    query.personnelId,
                );

            return {
                mode: 'personnel_services',
                keyword,
                ...summary,
            };
        }

        if (query.serviceId) {
            const service = await this.serviceService.findActiveServiceById(
                query.serviceId,
            );
            const personnel =
                await this.servicePersonnelService.searchPersonnelByServiceIds({
                    serviceIds: [query.serviceId],
                    page,
                    limit,
                    lat: query.lat,
                    lng: query.lng,
                    excludePersonnelUserId: userId,
                });

            return {
                mode: 'personnel_list',
                keyword,
                serviceHint: service
                    ? { serviceId: service.id, serviceName: service.name }
                    : { serviceId: query.serviceId },
                ...personnel,
            };
        }

        const exactPersonnel =
            await this.servicePersonnelService.findExactPersonnelByName(
                keyword,
            );

        if (exactPersonnel) {
            const summary =
                await this.servicePersonnelService.getPersonnelServicesSummary(
                    exactPersonnel.id,
                );

            return {
                mode: 'personnel_services',
                keyword,
                ...summary,
            };
        }

        const exactService =
            await this.serviceService.findExactActiveServiceByName(keyword);

        if (exactService) {
            const personnel =
                await this.servicePersonnelService.searchPersonnelByServiceIds({
                    serviceIds: [exactService.id],
                    page,
                    limit,
                    lat: query.lat,
                    lng: query.lng,
                    excludePersonnelUserId: userId,
                });

            return {
                mode: 'personnel_list',
                keyword,
                serviceHint: {
                    serviceId: exactService.id,
                    serviceName: exactService.name,
                },
                ...personnel,
            };
        }

        const matchedServices =
            await this.serviceService.searchActiveServicesByKeyword(
                keyword,
                10,
            );
        const serviceIds = matchedServices.map((item) => item.id);
        const serviceHint =
            matchedServices.length === 1 && matchedServices[0]
                ? {
                      serviceId: matchedServices[0].id,
                      serviceName: matchedServices[0].name,
                  }
                : undefined;

        const personnel =
            await this.servicePersonnelService.searchPersonnelByServiceIds({
                serviceIds,
                page,
                limit,
                lat: query.lat,
                lng: query.lng,
                excludePersonnelUserId: userId,
            });

        return {
            mode: 'personnel_list',
            keyword,
            serviceHint,
            ...personnel,
        };
    }

    async getHomeRecommendations(
        userId: string | undefined,
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
                      excludePersonnelUserId: userId,
                  })
                : await this.homeRepository.getRecommendedPersonnelGlobal({
                      limit,
                      offset,
                      categoryId,
                      excludePersonnelUserId: userId,
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
