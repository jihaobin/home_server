import { Controller, Get, Query } from '@nestjs/common';
import { AddressService } from './address.service';
import {
    AddressQuery,
    AddressQuerySchema,
    ChinaCitySchema,
    ReverseGeocodeRequest,
    ReverseGeocodeRequestSchema,
    ReverseGeocodeResponseSchema,
    SuggestionRequest,
    SuggestionRequestSchema,
    SuggestionResponseSchema,
} from '@repo/types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod/v4';
import {
    ApiQueries,
    ApiSuccessResponse,
    ApiErrorResponses,
} from 'src/common/decorator';
import { tencentReverseGeocodeService } from './address.gdMap.api';

@ApiTags('地址管理')
@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}

    @ApiOperation({
        summary: '获取中国城市数据',
        description:
            '根据筛选条件获取中国省市区数据，支持获取全部、省份、城市或区县数据',
    })
    @ApiSuccessResponse(z.array(ChinaCitySchema), {
        description: '成功获取城市列表',
        example: {
            code: 0,
            message: '操作成功',
            data: [
                {
                    id: 1,
                    pid: 0,
                    deep: 0,
                    name: '北京',
                    pinyin_prefix: 'B',
                    pinyin: 'beijing',
                    ext_id: '110000',
                    ext_name: '北京市',
                },
            ],
            timestamp: Date.now(),
        },
    })
    @ApiErrorResponses()
    @ApiQueries(AddressQuerySchema)
    @Get('all')
    findAll(@Query() query: AddressQuery) {
        return this.addressService.findAll(query);
    }

    @ApiOperation({
        summary: '地址逆解析服务',
        description: '根据经纬度获取详细地址信息',
    })
    @Get('reverse-geocode')
    @ApiQueries(ReverseGeocodeRequestSchema)
    @ApiSuccessResponse(ReverseGeocodeResponseSchema, {
        description: '成功获取地址信息',
    })
    @ApiErrorResponses()
    async reverseGeocode(@Query() query: ReverseGeocodeRequest) {
        return await tencentReverseGeocodeService.reverseGeocodeWithValidation(
            query,
        );
    }

    @ApiOperation({
        summary: '简化地址逆解析服务',
        description: '根据经纬度获取基础地址信息（不包含POI）',
    })
    @Get('simple-reverse-geocode')
    @ApiQueries(ReverseGeocodeRequestSchema)
    @ApiSuccessResponse(
        z.object({
            address: z.string().describe('标准格式化地址'),
            province: z.string().describe('省份'),
            city: z.string().describe('城市'),
            district: z.string().optional().describe('区县'),
            adcode: z.string().describe('行政区划代码'),
        }),
        {
            description: '成功获取简化地址信息',
        },
    )
    @ApiErrorResponses()
    async simpleReverseGeocode(@Query() query: ReverseGeocodeRequest) {
        return await tencentReverseGeocodeService.simpleReverseGeocode(query);
    }

    @ApiOperation({
        summary: '详细地址逆解析服务',
        description: '根据经纬度获取详细地址信息（包含周边POI）',
    })
    @Get('detailed-reverse-geocode')
    @ApiQueries(ReverseGeocodeRequestSchema)
    @ApiSuccessResponse(ReverseGeocodeResponseSchema, {
        description: '成功获取详细地址信息',
    })
    @ApiErrorResponses()
    async detailedReverseGeocode(@Query() query: ReverseGeocodeRequest) {
        return await tencentReverseGeocodeService.getDetailedAddress(query);
    }

    @Get('suggestion')
    @ApiOperation({
        summary: '地址建议服务',
        description: '根据关键词获取地址建议列表',
    })
    @ApiQueries(SuggestionRequestSchema)
    @ApiSuccessResponse(SuggestionResponseSchema, {
        description: '成功获取详细地址信息',
    })
    @ApiErrorResponses()
    async suggestion(@Query() query: SuggestionRequest) {
        return await tencentReverseGeocodeService.getSuggestions(query);
    }
}
