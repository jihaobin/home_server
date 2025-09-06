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
    @ApiSuccessResponse(ServiceCategoriesSchema, {
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
    @ApiBodies(
        z.object({
            name: z.string().max(100).optional().meta({
                description: '服务分类名称',
                title: '服务分类名称',
            }),
            description: z.string().optional().meta({
                description: '服务分类描述',
                title: '服务分类描述',
            }),
            parentId: z.string().max(255).optional().meta({
                description: '父分类ID',
                title: '父分类ID',
            }),
            dep: z.number().int().min(1).max(3).optional().meta({
                description: '服务分类深度',
                title: '服务分类深度',
            }),
            isActive: z.boolean().optional().meta({
                description: '服务分类是否启用',
                title: '服务分类是否启用',
            }),
        }),
    )
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
}
