import { fetch } from '../../lib/tencent-map-api-client';
import { z } from 'zod/v4';
import {
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import {
    ReverseGeocodeRequest,
    ReverseGeocodeRequestSchema,
    ReverseGeocodeResponse,
    ReverseGeocodeResponseSchema,
    PoiOptionsSchema,
    SuggestionRequest,
    SuggestionRequestSchema,
    SuggestionResponse,
    SuggestionResponseSchema,
} from '@repo/types';

// 腾讯地图API错误类型
interface TencentMapError {
    status: number;
    message: string;
    request_id?: string;
}

// POI选项字符串构建辅助函数
const buildPoiOptionsString = (
    options: z.infer<typeof PoiOptionsSchema>,
): string => {
    const params: string[] = [];

    if (options.address_format) {
        params.push(`address_format=${options.address_format}`);
    }

    if (options.radius) {
        params.push(`radius=${options.radius}`);
    }

    if (options.policy) {
        params.push(`policy=${options.policy}`);
    }

    if (options.orderby) {
        params.push(`orderby=${options.orderby}`);
    }

    if (options.added_fields && options.added_fields.length > 0) {
        params.push(`added_fields=${options.added_fields.join(',')}`);
    }

    return params.join(';');
};

/**
 * 腾讯地图逆地址解析API服务
 */
export class TencentReverseGeocodeService {
    /**
     * 关键词输入提示
     * 根据用户输入的关键词返回搜索建议
     *
     * @param params 关键词提示请求参数
     * @returns 关键词提示结果
     * @throws BadRequestException 参数验证失败
     * @throws InternalServerErrorException API调用失败
     */
    async getSuggestions(
        params: SuggestionRequest,
    ): Promise<SuggestionResponse> {
        try {
            // 验证请求参数
            const validatedParams = SuggestionRequestSchema.parse(params);

            // 调用腾讯地图关键词提示API
            const response: SuggestionResponse = await fetch(
                '/ws/place/v1/suggestion/',
                {
                    query: {
                        keyword: validatedParams.keyword,
                        ...(validatedParams.region && {
                            region: validatedParams.region,
                        }),
                        ...(validatedParams.region_fix && {
                            region_fix: validatedParams.region_fix,
                        }),
                        ...(validatedParams.location && {
                            location: validatedParams.location,
                        }),
                        ...(validatedParams.get_subpois && {
                            get_subpois: validatedParams.get_subpois,
                        }),
                        ...(validatedParams.get_ad && {
                            get_ad: validatedParams.get_ad,
                        }),
                        ...(validatedParams.policy && {
                            policy: validatedParams.policy,
                        }),
                        ...(validatedParams.filter && {
                            filter: validatedParams.filter,
                        }),
                        ...(validatedParams.added_fields &&
                            validatedParams.added_fields.length > 0 && {
                                added_fields:
                                    validatedParams.added_fields.join(','),
                            }),
                        ...(validatedParams.address_format && {
                            address_format: validatedParams.address_format,
                        }),
                        ...(validatedParams.page_index && {
                            page_index: validatedParams.page_index,
                        }),
                        ...(validatedParams.page_size && {
                            page_size: validatedParams.page_size,
                        }),
                        ...(validatedParams.output && {
                            output: validatedParams.output,
                        }),
                        ...(validatedParams.callback && {
                            callback: validatedParams.callback,
                        }),
                        // key 和 sig 会由客户端自动添加
                    },
                },
            );

            if (response.status !== 0) {
                const error = response as TencentMapError;
                throw new BadRequestException(
                    `腾讯地图API错误: ${error.message} (状态码: ${error.status})`,
                    {
                        cause: {
                            status: error.status,
                            message: error.message,
                            request_id: error.request_id,
                        },
                    },
                );
            }

            // 验证响应格式
            const validatedResponse = SuggestionResponseSchema.parse(response);

            return validatedResponse;
        } catch (error) {
            if (error instanceof z.ZodError) {
                // 参数验证错误
                const firstError = error.issues[0];
                throw new BadRequestException(
                    `参数验证失败: ${firstError.path.join('.')} ${firstError.message}`,
                    {
                        cause: {
                            zodError: error.issues,
                        },
                    },
                );
            }

            if (error instanceof BadRequestException) {
                // 重新抛出已知的业务错误
                throw error;
            }

            // 网络或其他未知错误
            throw new InternalServerErrorException(
                '关键词提示服务异常，请稍后重试',
                {
                    cause: {
                        originalError:
                            error instanceof Error
                                ? error
                                : new Error(String(error)),
                        message:
                            error instanceof Error ? error.message : '未知错误',
                    },
                },
            );
        }
    }

    /**
     * 简化的关键词提示方法
     * 只返回基础信息，适用于简单的搜索场景
     *
     * @param keyword 搜索关键词
     * @param region 可选的城市范围限制
     * @returns 简化的建议列表
     */
    async getSimpleSuggestions(
        keyword: string,
        region?: string,
    ): Promise<
        Array<{
            title: string;
            address: string;
            type: number;
            location: { lat: number; lng: number };
        }>
    > {
        const result = await this.getSuggestions({
            keyword,
            ...(region && { region }),
        });

        return result.data.map((item) => ({
            title: item.title,
            address: item.address || '',
            type: item.type,
            location: item.location,
        }));
    }

    /**
     * 获取收货地址建议
     * 专门用于收货地址场景的优化建议
     *
     * @param keyword 搜索关键词
     * @param location 可选的当前位置（用于距离排序）
     * @param region 可选的城市范围限制
     * @returns 收货地址建议列表
     */
    async getDeliveryAddressSuggestions(
        keyword: string,
        location?: string,
        region?: string,
    ): Promise<SuggestionResponse> {
        return await this.getSuggestions({
            keyword,
            policy: '1', // 收货地址策略
            ...(location && { location }),
            ...(region && { region }),
            address_format: 'short', // 返回短地址格式
        });
    }

    /**
     * 逆地址解析（支持结构化POI选项验证）
     * 根据经纬度获取对应的地址信息，当poi_options为对象时进行结构化验证
     *
     * @param params 请求参数（支持结构化POI选项）
     * @returns 地址解析结果
     * @throws BadRequestException 参数验证失败
     * @throws InternalServerErrorException API调用失败
     */
    async reverseGeocodeWithValidation(
        params: ReverseGeocodeRequest,
    ): Promise<ReverseGeocodeResponse> {
        try {
            // 验证请求参数
            const validatedParams = ReverseGeocodeRequestSchema.parse(params);

            // 处理poi_options参数
            let poiOptionsString: string | undefined;
            if (validatedParams.poi_options) {
                if (typeof validatedParams.poi_options === 'string') {
                    poiOptionsString = validatedParams.poi_options;
                } else {
                    // 结构化对象转换为字符串
                    poiOptionsString = buildPoiOptionsString(
                        validatedParams.poi_options,
                    );
                }
            }

            // 调用腾讯地图API
            const response: ReverseGeocodeResponse = await fetch(
                '/ws/geocoder/v1/',
                {
                    query: {
                        location: validatedParams.location,
                        ...(validatedParams.radius !== undefined && {
                            radius: validatedParams.radius,
                        }),
                        ...(validatedParams.get_poi && {
                            get_poi: validatedParams.get_poi,
                        }),
                        ...(poiOptionsString && {
                            poi_options: poiOptionsString,
                        }),
                        ...(validatedParams.output && {
                            output: validatedParams.output,
                        }),
                        ...(validatedParams.callback && {
                            callback: validatedParams.callback,
                        }),
                        // key 和 sig 会由客户端自动添加
                    },
                },
            );

            if (response.status !== 0) {
                const error = response as TencentMapError;
                throw new BadRequestException(
                    `腾讯地图API错误: ${error.message} (状态码: ${error.status})`,
                    {
                        cause: {
                            status: error.status,
                            message: error.message,
                            request_id: error.request_id,
                        },
                    },
                );
            }

            // 验证响应格式
            const validatedResponse =
                ReverseGeocodeResponseSchema.parse(response);

            // 检查API状态码
            if (validatedResponse.status !== 0) {
                const error = response as TencentMapError;
                throw new BadRequestException(
                    `腾讯地图API错误: ${error.message} (状态码: ${error.status})`,
                    {
                        cause: {
                            status: error.status,
                            message: error.message,
                            request_id: error.request_id,
                        },
                    },
                );
            }

            return validatedResponse;
        } catch (error) {
            if (error instanceof z.ZodError) {
                // 参数验证错误
                const firstError = error.issues[0];
                throw new BadRequestException(
                    `参数验证失败: ${firstError.path.join('.')} ${firstError.message}`,
                    {
                        cause: {
                            zodError: error.issues,
                        },
                    },
                );
            }

            if (error instanceof BadRequestException) {
                // 重新抛出已知的业务错误
                throw error;
            }

            // 网络或其他未知错误
            throw new InternalServerErrorException(
                '逆地址解析服务异常，请稍后重试',
                {
                    cause: {
                        originalError:
                            error instanceof Error
                                ? error
                                : new Error(String(error)),
                        message:
                            error instanceof Error ? error.message : '未知错误',
                    },
                },
            );
        }
    }

    /**
     * 简化的逆地址解析方法
     * 只获取基础地址信息，不包含POI
     *
     * @param params 请求参数
     * @returns 简化的地址信息
     */
    async simpleReverseGeocode(params: ReverseGeocodeRequest): Promise<{
        address: string;
        province: string;
        city: string;
        district?: string;
        adcode: string;
    }> {
        const result = await this.reverseGeocodeWithValidation({
            ...params,
            get_poi: '0',
        });

        return {
            address: result.result.address,
            province: result.result.address_component.province,
            city: result.result.address_component.city,
            district: result.result.address_component.district,
            adcode: result.result.ad_info.adcode,
        };
    }

    /**
     * 获取详细地址信息，包含周边POI（使用结构化验证）
     *
     * @param params 请求参数（支持结构化POI选项）
     * @returns 详细的地址信息
     */
    async getDetailedAddress(
        params: ReverseGeocodeRequest,
    ): Promise<ReverseGeocodeResponse> {
        // 直接使用结构化验证的方法
        return await this.reverseGeocodeWithValidation({
            ...params,
            get_poi: '1',
        });
    }
}

// 导出服务实例
export const tencentReverseGeocodeService = new TencentReverseGeocodeService();
