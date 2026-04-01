import {
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import {
    type DistrictSearchRequest,
    type DistrictSearchResponse,
    DistrictSearchResponseSchema,
    type ExploreRequest,
    type ExploreResponse,
    ExploreResponseSchema,
    type GeocodeRequest,
    type GeocodeResponse,
    GeocodeResponseSchema,
    type PoiOptionsSchema,
    type ReverseGeocodeRequest,
    type ReverseGeocodeResponse,
    ReverseGeocodeResponseSchema,
    type SuggestionRequest,
    type SuggestionResponse,
    SuggestionResponseSchema,
} from '@repo/types';
import { z } from 'zod/v4';
import { fetch } from '../../lib/tencent-map-api-client';

// 腾讯地图API错误类型
interface TencentMapError {
    status: number;
    message: string;
    request_id?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const parseLocation = (location: string) => {
    const [lat, lng] = location.split(',');

    return {
        lat,
        lng,
    };
};

const getErrorContext = (error: unknown) => {
    if (error instanceof Error) {
        const details: Record<string, unknown> = {
            name: error.name,
            message: error.message,
        };

        if ('cause' in error) {
            details.cause = error.cause;
        }

        if (isRecord(error)) {
            if ('status' in error) {
                details.status = error.status;
            }

            if ('statusCode' in error) {
                details.statusCode = error.statusCode;
            }

            if ('data' in error) {
                details.data = error.data;
            }

            const response = error.response;
            if (isRecord(response)) {
                details.response = {
                    status: response.status,
                    data: '_data' in response ? response._data : undefined,
                };
            }
        }

        return details;
    }

    return {
        value: String(error),
    };
};

type DistrictSearchApiResponse = Omit<DistrictSearchResponse, 'result'> & {
    result: DistrictSearchResponse['result'][];
};

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
    private readonly logger = new Logger(TencentReverseGeocodeService.name);

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
            // 调用腾讯地图关键词提示API
            const response: SuggestionResponse = await fetch(
                '/ws/place/v1/suggestion/',
                {
                    query: {
                        keyword: params.keyword,
                        ...(params.region && {
                            region: params.region,
                        }),
                        ...(params.region_fix && {
                            region_fix: params.region_fix.toString(),
                        }),
                        ...(params.location && {
                            location: params.location,
                        }),
                        ...(params.get_subpois && {
                            get_subpois: params.get_subpois,
                        }),
                        ...(params.get_ad && {
                            get_ad: params.get_ad,
                        }),
                        ...(params.policy && {
                            policy: params.policy,
                        }),
                        ...(params.filter && {
                            filter: params.filter,
                        }),
                        ...(params.added_fields &&
                            params.added_fields.length > 0 && {
                                added_fields: params.added_fields.join(','),
                            }),
                        ...(params.address_format && {
                            address_format: params.address_format,
                        }),
                        ...(params.page_index && {
                            page_index: params.page_index,
                        }),
                        ...(params.page_size && {
                            page_size: params.page_size,
                        }),
                        ...(params.output && {
                            output: params.output,
                        }),
                        ...(params.callback && {
                            callback: params.callback,
                        }),
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
        const requestPath = '/ws/geocoder/v1/';
        try {
            // 处理poi_options参数
            let poiOptionsString: string | undefined;
            if (params.poi_options) {
                if (typeof params.poi_options === 'string') {
                    poiOptionsString = params.poi_options;
                } else {
                    // 结构化对象转换为字符串
                    poiOptionsString = buildPoiOptionsString(
                        params.poi_options,
                    );
                }
            }

            // 调用腾讯地图API
            const response: ReverseGeocodeResponse = await fetch(
                '/ws/geocoder/v1/',
                {
                    query: {
                        location: params.location,
                        ...(params.radius !== undefined && {
                            radius: params.radius,
                        }),
                        ...(params.get_poi && {
                            get_poi: params.get_poi,
                        }),
                        ...(poiOptionsString && {
                            poi_options: poiOptionsString,
                        }),
                        ...(params.output && {
                            output: params.output,
                        }),
                        ...(params.callback && {
                            callback: params.callback,
                        }),
                    },
                },
            );

            if (response.status !== 0) {
                const error = response as TencentMapError;
                const { lat, lng } = parseLocation(params.location);

                this.logger.error(
                    `腾讯地图逆地址解析业务错误: ${JSON.stringify({
                        path: requestPath,
                        location: params.location,
                        lat,
                        lng,
                        radius: params.radius,
                        get_poi: params.get_poi,
                        poi_options: poiOptionsString,
                        output: params.output,
                        callback: params.callback,
                        tencent_status: error.status,
                        tencent_message: error.message,
                        request_id: error.request_id,
                    })}`,
                );

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

            const { lat, lng } = parseLocation(params.location);

            this.logger.error(
                `腾讯地图逆地址解析请求异常: ${JSON.stringify({
                    path: requestPath,
                    location: params.location,
                    lat,
                    lng,
                    radius: params.radius,
                    get_poi: params.get_poi,
                    poi_options:
                        typeof params.poi_options === 'string'
                            ? params.poi_options
                            : params.poi_options
                              ? buildPoiOptionsString(params.poi_options)
                              : undefined,
                    output: params.output,
                    callback: params.callback,
                    error: getErrorContext(error),
                })}`,
            );

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
     * 地址解析（地址转坐标）
     * 根据文字地址获取对应的经纬度坐标
     *
     * @param params 地址解析请求参数
     * @returns 地址解析结果
     * @throws BadRequestException 参数验证失败或API调用失败
     * @throws InternalServerErrorException 服务异常
     */
    async geocode(params: GeocodeRequest): Promise<GeocodeResponse> {
        try {
            // 调用腾讯地图地址解析API
            const response: GeocodeResponse = await fetch('/ws/geocoder/v1/', {
                query: {
                    address: params.address,
                    ...(params.policy && {
                        policy: params.policy,
                    }),
                    ...(params.output && {
                        output: params.output,
                    }),
                    ...(params.callback && {
                        callback: params.callback,
                    }),
                    // key 和 sig 会由客户端自动添加
                },
            });

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

            // 验证响应格式 - 使用类型断言确保类型安全
            const validatedResponse = GeocodeResponseSchema.parse(response);

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
                '地址解析服务异常，请稍后重试',
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
     * 行政区域搜索
     * 根据关键词或行政区划代码搜索行政区域信息
     *
     * @param params 行政区域搜索请求参数
     * @returns 行政区域搜索结果
     * @throws BadRequestException 参数验证失败或API调用失败
     * @throws InternalServerErrorException 服务异常
     */
    async districtSearch(
        params: DistrictSearchRequest,
    ): Promise<DistrictSearchResponse> {
        try {
            // 调用腾讯地图行政区域搜索API
            const response: DistrictSearchApiResponse = await fetch(
                '/ws/district/v1/search',
                {
                    query: {
                        keyword: params.keyword,
                        ...(params.get_polygon && {
                            get_polygon: params.get_polygon,
                        }),
                        ...(params.max_offset && {
                            max_offset: params.max_offset,
                        }),
                        ...(params.output && {
                            output: params.output,
                        }),
                        ...(params.callback && {
                            callback: params.callback,
                        }),
                        // key 和 sig 会由客户端自动添加
                    },
                },
            );

            const result: DistrictSearchResponse = {
                ...response,
                result: response.result.flat(),
            };
            if (response.status !== 0) {
                const error = response as unknown as TencentMapError;
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
                DistrictSearchResponseSchema.parse(result);

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
                '行政区域搜索服务异常，请稍后重试',
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
     * 周边推荐（explore）
     * 只需提供搜索中心点及半径，即可搜索获取周边高热度地点
     * 一般用于发送位置、地点签到等场景，自动为用户提供备选地点列表
     *
     * @param params 周边推荐请求参数
     * @returns 周边推荐结果
     * @throws BadRequestException 参数验证失败
     * @throws InternalServerErrorException API调用失败
     */
    async explore(params: ExploreRequest): Promise<ExploreResponse> {
        try {
            // 构建boundary字符串参数
            const { lat, lng, radius, auto_extend } = params.boundary;
            const boundaryString = `nearby(${lat},${lng},${radius}${auto_extend !== undefined ? `,${auto_extend ? 1 : 0}` : ''})`;

            // 构建filter字符串参数
            let filterString: string | undefined;
            if (
                params.filter?.categories &&
                params.filter.categories.length > 0
            ) {
                filterString = `category=${params.filter.categories.join(',')}`;
            }

            // 调用腾讯地图周边推荐API
            const response: ExploreResponse = await fetch(
                '/ws/place/v1/explore',
                {
                    query: {
                        boundary: boundaryString,
                        ...(params.policy && {
                            policy: params.policy,
                        }),
                        ...(filterString && {
                            filter: filterString,
                        }),
                        ...(params.orderby && {
                            orderby: params.orderby,
                        }),
                        ...(params.location_mode && {
                            location_mode: params.location_mode,
                        }),
                        ...(params.address_format && {
                            address_format: params.address_format,
                        }),
                        ...(params.page_size && {
                            page_size: params.page_size,
                        }),
                        ...(params.page_index && {
                            page_index: params.page_index,
                        }),
                        ...(params.output && {
                            output: params.output,
                        }),
                        ...(params.callback && {
                            callback: params.callback,
                        }),
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
            const validatedResponse = ExploreResponseSchema.parse(response);
            return validatedResponse;
        } catch (error) {
            // 如果是已知的业务异常，直接抛出
            if (
                error instanceof BadRequestException ||
                error instanceof InternalServerErrorException
            ) {
                throw error;
            }

            // Zod验证错误
            if (error instanceof z.ZodError) {
                throw new BadRequestException('周边推荐API响应格式验证失败', {
                    cause: {
                        validationErrors: error.issues,
                        message: '响应数据格式不符合预期',
                    },
                });
            }

            // 网络或其他未知错误
            throw new InternalServerErrorException(
                '周边推荐服务异常，请稍后重试',
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
}

// 导出服务实例
export const tencentReverseGeocodeService = new TencentReverseGeocodeService();
