import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    type AddressQuery,
    AddressQuerySchema,
    ChinaCitySchema,
    type CreateUserAddress,
    CreateUserAddressSchema,
    type DistrictSearchRequest,
    DistrictSearchRequestSchema,
    DistrictSearchResponseSchema,
    EcplortPoiSchema,
    type GeocodeRequest,
    GeocodeRequestSchema,
    LocationSchema,
    ParentInfoSchema,
    type ReverseGeocodeRequest,
    ReverseGeocodeRequestSchema,
    ReverseGeocodeResponseSchema,
    type SuggestionRequest,
    SuggestionRequestSchema,
    SuggestionResponseSchema,
    type UpdateUserAddress,
    UpdateUserAddressSchema,
    UserAddressesSchema,
} from '@repo/types';
import { Request } from 'express';
import { ApiQueries, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { ZodValidationPipe } from 'src/common/pipes';
import { z } from 'zod/v4';
import { AuthGuard } from '../auth/auth.guard';
import { AddressService } from './address.service';
import { tencentReverseGeocodeService } from './address.TencentMap.api';

@ApiTags('地址管理')
@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}

    @UsePipes(new ZodValidationPipe(AddressQuerySchema))
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
    @ApiQueries(AddressQuerySchema)
    @Get('all')
    findAll(@Query() query: AddressQuery) {
        return this.addressService.findAll(query);
    }

    @UsePipes(
        new ZodValidationPipe(
            ReverseGeocodeRequestSchema,
            '请求参数验证失败',
            false,
        ),
    )
    @ApiOperation({
        summary: '地址逆解析服务',
        description: '根据经纬度获取详细地址信息',
    })
    @Get('reverse-geocode')
    @ApiQueries(ReverseGeocodeRequestSchema)
    @ApiSuccessResponse(ReverseGeocodeResponseSchema, {
        description: '成功获取地址信息',
    })
    async reverseGeocode(@Query() query: ReverseGeocodeRequest) {
        return await tencentReverseGeocodeService.reverseGeocodeWithValidation(
            query,
        );
    }

    @UsePipes(
        new ZodValidationPipe(
            SuggestionRequestSchema,
            '请求参数验证失败',
            false,
        ),
    )
    @Get('suggestion')
    @ApiOperation({
        summary: '地址建议服务',
        description: '根据关键词获取地址建议列表',
    })
    @ApiQueries(SuggestionRequestSchema)
    @ApiSuccessResponse(SuggestionResponseSchema, {
        description: '成功获取详细地址信息',
    })
    async suggestion(@Query() query: SuggestionRequest) {
        return await tencentReverseGeocodeService.getSuggestions(query);
    }

    @Get('cityParentInfo')
    @UsePipes(new ZodValidationPipe(GeocodeRequestSchema))
    @ApiOperation({
        summary: '获取城市的上级城市和省份信息',
        description: '根据城市名称获取其上级城市和省份信息',
    })
    @ApiQueries(GeocodeRequestSchema)
    @ApiSuccessResponse(ParentInfoSchema, {
        description: '成功获取城市的上级城市和省份信息',
    })
    async getCityParentInfo(@Query() query: GeocodeRequest) {
        return await this.addressService.getCityParentInfo(query);
    }

    @UsePipes(new ZodValidationPipe(DistrictSearchRequestSchema))
    @Get('districtSearch')
    @ApiOperation({
        summary: '搜索城市',
        description: '根据关键词搜索城市',
    })
    @ApiQueries(DistrictSearchRequestSchema)
    @ApiSuccessResponse(DistrictSearchResponseSchema, {
        description: '成功获取城市搜索结果',
    })
    async districtSearch(@Query() query: DistrictSearchRequest) {
        return await this.addressService.districtSearch(query.keyword);
    }

    @UsePipes(new ZodValidationPipe(LocationSchema))
    @Get('explore')
    @ApiOperation({
        summary: '探索周边地点',
        description: '探索周边地点',
    })
    @ApiQueries(LocationSchema)
    @ApiSuccessResponse(EcplortPoiSchema, {
        description: '成功获取城市搜索结果',
    })
    async explore(@Query() query: { lat: number; lng: number }) {
        return await this.addressService.explore(query);
    }

    @UseGuards(AuthGuard)
    @UsePipes(new ZodValidationPipe(CreateUserAddressSchema))
    @ApiOperation({
        summary: '创建用户地址',
        description: '创建用户地址',
    })
    @ApiBodies(CreateUserAddressSchema)
    @ApiSuccessResponse(UserAddressesSchema, {
        description: '成功创建用户地址',
    })
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

    @UseGuards(AuthGuard)
    @UsePipes(new ZodValidationPipe(UpdateUserAddressSchema))
    @ApiOperation({
        summary: '更新用户地址',
        description: '更新用户地址',
    })
    @ApiBodies(UpdateUserAddressSchema)
    @ApiSuccessResponse(UserAddressesSchema, {
        description: '成功更新用户地址',
    })
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

    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: '删除用户地址',
        description: '删除用户地址',
    })
    @ApiParam({ name: 'id', description: '用户地址ID' })
    @Delete(':id')
    deleteUserAddress(@Param('id') id: string) {
        return this.addressService.deleteAddress(id);
    }

    @UsePipes(new ZodValidationPipe(UpdateUserAddressSchema))
    @ApiOperation({
        summary: '获取用户地址列表',
        description: '获取当前用户的所有地址(需登录后使用)',
    })
    @ApiSuccessResponse(UserAddressesSchema, {
        description: '成功获取用户地址列表',
    })
    @UseGuards(AuthGuard)
    @Get()
    async getUserAddress(@Req() req: Request) {
        return await this.addressService.getAddressByUserId(req.user?.id);
    }
}
