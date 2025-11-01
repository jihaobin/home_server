import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UsePipes,
} from '@nestjs/common';
import { ServiceService } from './service.service';
import {
    ServiceCategoryRequest,
    ServiceCategoryRequestSchema,
    ServiceCategoriesSchema,
    CreateServiceCategorySchema,
    CreateServiceCategory,
    UpdateServiceCategorySchema,
    UpdateServiceCategory,
    ServiceListRequest,
    ServiceListRequestSchema,
    ServiceListResponseSchema,
    CreateService,
    CreateServiceSchema,
    UpdateService,
    UpdateServiceSchema,
    ServiceDetailSchema,
    ServiceStatsSchema,
    serviceCategoriesSchema,
} from '@repo/types';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { z } from 'zod/v4';
import { ZodValidationPipe, createMultiZodPipe } from 'src/common/pipes';

@ApiTags('服务分类模块')
@Controller('service')
export class ServiceController {
    constructor(private readonly serviceService: ServiceService) {}

    @Get('getCategories')
    @UsePipes(new ZodValidationPipe(ServiceCategoryRequestSchema))
    @ApiOperation({
        summary: '获取服务分类',
        description: '获取服务分类',
    })
    @ApiQueries(ServiceCategoryRequestSchema)
    @ApiSuccessResponse(z.array(serviceCategoriesSchema), {
        description: '服务分类列表',
    })
    @ApiErrorResponses()
    async getServiceCategories(@Query() query: ServiceCategoryRequest) {
        const dep = query.dep ? +query.dep : 0;
        const keyword = query.keyword ? query.keyword : '';
        return await this.serviceService.getServiceCategories(dep, keyword);
    }

    @Post('categories')
    @UsePipes(new ZodValidationPipe(CreateServiceCategorySchema))
    @ApiOperation({
        summary: '创建服务分类',
        description: '创建新的服务分类',
    })
    @ApiBodies(CreateServiceCategorySchema)
    @ApiSuccessResponse(ServiceCategoriesSchema, {
        description: '成功创建服务分类',
    })
    @ApiErrorResponses()
    async createServiceCategory(@Body() body: CreateServiceCategory) {
        return await this.serviceService.createServiceCategory(body);
    }

    @Put('categories/:id')
    @UsePipes(
        createMultiZodPipe({
            params: z.string().max(255).min(1, 'ID不能为空').meta({
                description: '服务分类ID',
                title: '服务分类ID',
            }),
            body: UpdateServiceCategorySchema.omit({ id: true }),
        }),
    )
    @ApiOperation({
        summary: '更新服务分类',
        description: '更新指定的服务分类',
    })
    @ApiParam({ name: 'id', description: '服务分类ID' })
    @ApiBodies(UpdateServiceCategorySchema.omit({ id: true }))
    @ApiSuccessResponse(ServiceCategoriesSchema, {
        description: '成功更新服务分类',
    })
    async updateServiceCategory(
        @Param('id') id: string,
        @Body() body: Partial<UpdateServiceCategory>,
    ) {
        return await this.serviceService.updateServiceCategory(id, body);
    }

    @Delete('categories/:id')
    @ApiOperation({
        summary: '删除服务分类',
        description: '删除指定的服务分类',
    })
    @ApiParam({ name: 'id', description: '服务分类ID' })
    @ApiSuccessResponse(
        z.object({
            success: z.boolean().meta({
                description: '是否成功',
                title: '是否成功',
            }),
            message: z.string().meta({
                description: '操作消息',
                title: '操作消息',
            }),
        }),
        {
            description: '成功删除服务分类',
        },
    )
    @ApiErrorResponses()
    async deleteServiceCategory(@Param('id') id: string) {
        return await this.serviceService.deleteServiceCategory(id);
    }

    @Get('categories/:id')
    @ApiOperation({
        summary: '获取指定服务分类',
        description: '根据ID获取指定的服务分类',
    })
    @ApiParam({ name: 'id', description: '服务分类ID' })
    @ApiSuccessResponse(ServiceCategoriesSchema, {
        description: '服务分类详情',
    })
    @ApiErrorResponses()
    async getServiceCategoryById(@Param('id') id: string) {
        return await this.serviceService.getServiceCategoryById(id);
    }

    // ========== 服务项目相关API ==========

    @Get('services')
    @UsePipes(new ZodValidationPipe(ServiceListRequestSchema))
    @ApiOperation({
        summary: '获取服务项目列表',
        description: '获取服务项目列表，支持分页和筛选',
    })
    @ApiQueries(ServiceListRequestSchema)
    @ApiSuccessResponse(ServiceListResponseSchema, {
        description: '服务项目列表',
    })
    @ApiErrorResponses()
    async getServices(@Query() query: ServiceListRequest) {
        return await this.serviceService.getServices(query);
    }

    @Get('services/stats')
    @ApiOperation({
        summary: '获取服务统计信息',
        description: '获取服务项目相关统计数据',
    })
    @ApiSuccessResponse(ServiceStatsSchema, {
        description: '服务统计信息',
    })
    @ApiErrorResponses()
    async getServiceStats() {
        return await this.serviceService.getServiceStats();
    }

    @Get('services/:id')
    @ApiOperation({
        summary: '获取指定服务项目',
        description: '根据ID获取指定的服务项目详情',
    })
    @ApiParam({ name: 'id', description: '服务项目ID' })
    @ApiSuccessResponse(ServiceDetailSchema, {
        description: '服务项目详情',
    })
    @ApiErrorResponses()
    async getServiceById(@Param('id') id: string) {
        return await this.serviceService.getServiceById(id);
    }

    @Post('services')
    @UsePipes(new ZodValidationPipe(CreateServiceSchema))
    @ApiOperation({
        summary: '创建服务项目',
        description: '创建新的服务项目',
    })
    @ApiBodies(CreateServiceSchema)
    @ApiSuccessResponse(ServiceDetailSchema, {
        description: '成功创建服务项目',
    })
    @ApiErrorResponses()
    async createService(@Body() body: CreateService) {
        return await this.serviceService.createService(body);
    }

    @Put('services/:id')
    @UsePipes(
        createMultiZodPipe({
            params: z.string().max(255).min(1, 'ID不能为空').meta({
                description: '服务项目ID',
                title: '服务项目ID',
            }),
            body: UpdateServiceSchema.omit({ id: true }),
        }),
    )
    @ApiOperation({
        summary: '更新服务项目',
        description: '更新指定的服务项目',
    })
    @ApiParam({ name: 'id', description: '服务项目ID' })
    @ApiBodies(UpdateServiceSchema.omit({ id: true }))
    @ApiSuccessResponse(ServiceDetailSchema, {
        description: '成功更新服务项目',
    })
    @ApiErrorResponses()
    async updateService(
        @Param('id') id: string,
        @Body() body: Partial<UpdateService>,
    ) {
        return await this.serviceService.updateService(id, body);
    }

    @Delete('services/:id')
    @ApiOperation({
        summary: '删除服务项目',
        description: '删除指定的服务项目',
    })
    @ApiParam({ name: 'id', description: '服务项目ID' })
    @ApiSuccessResponse(
        z.object({
            success: z.boolean().meta({
                description: '是否成功',
                title: '是否成功',
            }),
            message: z.string().meta({
                description: '操作消息',
                title: '操作消息',
            }),
        }),
        {
            description: '成功删除服务项目',
        },
    )
    @ApiErrorResponses()
    async deleteService(@Param('id') id: string) {
        return await this.serviceService.deleteService(id);
    }
}
