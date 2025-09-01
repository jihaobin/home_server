import { Inject, Injectable } from '@nestjs/common';
import {
    AddressQuery,
    UpdateUserAddress,
    CreateUserAddress,
} from '@repo/types';
import { AddressRespository } from './address.repository';
import { tencentReverseGeocodeService } from './address.TencentMap.api';
import { CACHE_SERVICE, IAdvancedCacheService } from 'src/common/cache';
import { GeocodeRequest } from '@repo/types';
import { ParentInfo } from '@repo/types';
import { DbType } from 'src/common/database/db';
import { DB } from 'src/common/database/database.provider';
import { sql } from 'drizzle-orm';
import { Location } from '@repo/types';

// 城市和上级城市和省份的缓存key
const CACHE_KEY_PREFIX = 'address:geocode:address';

@Injectable()
export class AddressService {
    @Inject(DB)
    private readonly db: DbType;

    @Inject()
    private readonly addressRepository: AddressRespository;
    @Inject(CACHE_SERVICE)
    private readonly cacheService: IAdvancedCacheService;

    findAll(query: AddressQuery) {
        return this.addressRepository.find(query);
    }

    updateAddress(id: string, data: UpdateUserAddress) {
        return this.addressRepository.updateAddress(id, data);
    }

    createAddress(data: CreateUserAddress) {
        return this.addressRepository.createAddress(data);
    }

    async deleteAddress(id: string) {
        await this.addressRepository.deleteAddress(id);
        return '删除成功';
    }

    getAddressByUserId(id: string) {
        return this.addressRepository.findByUserId(id);
    }

    /**
     * 根据城市名称获取它的上级城市和省份
     * @param query GeocodeRequest
     * @returns 上级城市和省份信息
     */
    async getCityParentInfo(query: GeocodeRequest) {
        try {
            const cache = await this.cacheService.hGet<ParentInfo>(
                CACHE_KEY_PREFIX,
                query.address,
            );
            if (cache) {
                return cache;
            }

            const response = await tencentReverseGeocodeService.geocode(query);

            const result: ParentInfo = {
                province: response.result.address_components.province,
                city: response.result.address_components.city,
                district: response.result.address_components.district,
                location: {
                    lng: response.result.location.lng,
                    lat: response.result.location.lat,
                },
            };

            if (result) {
                await this.cacheService.hSet<ParentInfo>(
                    CACHE_KEY_PREFIX,
                    query.address,
                    result,
                );
            }
            return result;
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * 搜索城市(省/市/县(区))
     */
    async districtSearch(keyword: string) {
        const response = await tencentReverseGeocodeService.districtSearch({
            keyword,
        });
        return response.result.filter((filterItem) => filterItem.level <= 3);
    }

    /**
     * 周边推荐（explore）
     * 只需提供搜索中心点及半径，即可搜索获取周边高热度地点
     * 一般用于发送位置、地点签到等场景，自动为用户提供备选地点列表
     *
     * @param params 周边推荐请求参数
     * @returns 周边推荐结果
     * @throws BadRequestException 参数验证失败
     * @throws InternalServerErrorException API调用失败
     */
    async explore({ lat, lng }: Location) {
        // 排除第一个数据，因为第一个数据当前用户所在的城市
        const explortAddress = (
            await tencentReverseGeocodeService.explore({
                boundary: {
                    lat,
                    lng,
                    radius: 1000,
                    auto_extend: true,
                },
                orderby: '_distance',
                policy: '1',
                location_mode: '0',
                page_size: 20,
                page_index: 1,
                output: 'json',
            })
        ).data.filter((_, index) => index !== 0);

        // 从userAddress数据表中根据周边地点的邻居数量
        // 如果没有探索地点，直接返回空数组
        if (explortAddress.length === 0) {
            return [];
        }

        // 优化性能：使用单个查询批量计算所有地点的邻居数量
        // 使用更简单的方法：构建VALUES子句
        const locationValues = explortAddress
            .map(
                (place) =>
                    `('${place.id}', ${place.location.lng}, ${place.location.lat})`,
            )
            .join(', ');

        // 使用单个查询获取所有地点的邻居数量
        const neighborCounts = await this.db.execute(
            sql.raw(`
            WITH explore_locations(poi_id, lng, lat) AS (
                VALUES ${locationValues}
            )
            SELECT
                el.poi_id,
                el.lng,
                el.lat,
                COUNT(ua.id) as neighbor_count
            FROM explore_locations el
            LEFT JOIN user_addresses ua ON ST_DWithin(
                ua.geom::GEOGRAPHY,
                ST_SetSRID(ST_MakePoint(el.lng, el.lat), 4326)::GEOGRAPHY,
                15
            )
            GROUP BY el.poi_id, el.lng, el.lat
            ORDER BY el.poi_id
        `),
        );

        // 将邻居数量映射回原始数据
        const neighborCountMap = new Map(
            neighborCounts.rows.map((row: Record<string, any>) => [
                String(row.poi_id),
                Number(row.neighbor_count || 0),
            ]),
        );

        const exploreWithNeighborCount = explortAddress.map((place) => ({
            ...place,
            neighborCount: neighborCountMap.get(place.id) || 0,
        }));

        return exploreWithNeighborCount;
    }
}
