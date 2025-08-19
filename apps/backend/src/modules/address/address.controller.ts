import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UsePipes,
    UseGuards,
} from '@nestjs/common';
import { AddressService } from './address.service';
import {
    AddressQuery,
    AddressQuerySchema,
    ChinaCitySchema,
    CreateUserAddress,
    ReverseGeocodeRequest,
    ReverseGeocodeRequestSchema,
    ReverseGeocodeResponseSchema,
    SuggestionRequest,
    SuggestionRequestSchema,
    SuggestionResponseSchema,
    UpdateUserAddress,
    UpdateUserAddressSchema,
} from '@repo/types';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod/v4';
import {
    ApiQueries,
    ApiSuccessResponse,
    ApiErrorResponses,
} from 'src/common/decorator';
import { tencentReverseGeocodeService } from './address.gdMap.api';
import { Request } from 'express';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { CreateUserAddressSchema } from '@repo/types';
import { UserAddressesSchema } from '@repo/types';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';

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

    @UseGuards(AuthGuard)
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

    @UsePipes(new ZodValidationPipe(CreateUserAddressSchema))
    @ApiOperation({
        summary: '创建用户地址',
        description: '创建用户地址',
    })
    @ApiBodies(CreateUserAddressSchema)
    @ApiSuccessResponse(UserAddressesSchema, {
        description: '成功创建用户地址',
    })
    @ApiErrorResponses()
    @Post('create')
    async createUserAddress(
        @Body() body: Omit<CreateUserAddress, 'userId'>,
        @Req() req: Request,
    ) {
        return await this.addressService.createAddress({
            ...body,
            userId: req.user?.id,
        });
    }

    @UsePipes(new ZodValidationPipe(UpdateUserAddressSchema))
    @ApiOperation({
        summary: '更新用户地址',
        description: '更新用户地址',
    })
    @ApiBodies(UpdateUserAddressSchema)
    @ApiSuccessResponse(UserAddressesSchema, {
        description: '成功更新用户地址',
    })
    @ApiErrorResponses()
    @Post('update')
    async updateUserAddress(
        @Body() body: UpdateUserAddress,
        @Req() req: Request,
    ) {
        return await this.addressService.updateAddress(body.id, {
            ...body,
            userId: req.user?.id,
        });
    }

    @ApiOperation({
        summary: '删除用户地址',
        description: '删除用户地址',
    })
    @ApiParam({ name: 'id', description: '用户地址ID' })
    @ApiErrorResponses()
    @Delete(':id')
    deleteUserAddress(@Param('id') id: string) {
        return this.addressService.deleteAddress(id);
    }

    @ApiOperation({
        summary: '获取用户地址列表',
        description: '获取当前用户的所有地址(需登录后使用)',
    })
    @ApiSuccessResponse(UserAddressesSchema, {
        description: '成功获取用户地址列表',
    })
    @UseGuards(AuthGuard)
    @ApiErrorResponses()
    @Get()
    async getUserAddress(@Req() req: Request) {
        return await this.addressService.getAddressByUserId(req.user?.id);
    }
}
