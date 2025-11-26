import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    AdminServiceCategoryListResponseSchema,
    AdminServiceCategorySchema,
    CreateAdminServiceCategoryInput,
    CreateAdminServiceCategorySchema,
    UpdateAdminServiceCategoryInput,
    UpdateAdminServiceCategorySchema,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { createMultiZodPipe, ZodValidationPipe } from 'src/common/pipes';
import { z } from 'zod/v4';
import { AdminServiceCategoriesService } from './admin-service-categories.service';

const CategoryIdSchema = z
    .string()
    .max(255)
    .min(1, 'ID不能为空')
    .describe('服务分类 ID');

@ApiTags('管理员-服务分类')
@Controller('admin/service-categories')
export class AdminServiceCategoriesController {
    constructor(private readonly service: AdminServiceCategoriesService) {}

    @Get()
    @ApiOperation({
        summary: '获取服务分类列表',
        description: '返回树形结构与拍平列表',
    })
    @ApiSuccessResponse(AdminServiceCategoryListResponseSchema, {
        description: '服务分类树与列表',
    })
    async listCategories() {
        return this.service.listCategories();
    }

    @Get(':id')
    @ApiOperation({
        summary: '获取服务分类详情',
        description: '根据 ID 查询服务分类',
    })
    @ApiParam({ name: 'id', description: '分类 ID' })
    @ApiSuccessResponse(AdminServiceCategorySchema, {
        description: '服务分类详情',
    })
    @ApiErrorResponses()
    async getCategory(@Param('id') id: string) {
        return this.service.getCategory(id);
    }

    @Post()
    @UsePipes(new ZodValidationPipe(CreateAdminServiceCategorySchema))
    @ApiOperation({
        summary: '创建服务分类',
        description: '新增一级或二级分类',
    })
    @ApiBodies(CreateAdminServiceCategorySchema)
    @ApiSuccessResponse(AdminServiceCategorySchema, {
        description: '创建成功后的分类',
    })
    @ApiErrorResponses()
    async createCategory(@Body() body: CreateAdminServiceCategoryInput) {
        return this.service.createCategory(body);
    }

    @Put(':id')
    @UsePipes(
        createMultiZodPipe({
            params: CategoryIdSchema,
            body: UpdateAdminServiceCategorySchema,
        }),
    )
    @ApiOperation({
        summary: '更新服务分类',
        description: '修改分类基础信息、父级、排序、图标等',
    })
    @ApiParam({ name: 'id', description: '分类 ID' })
    @ApiBodies(UpdateAdminServiceCategorySchema)
    @ApiSuccessResponse(AdminServiceCategorySchema, {
        description: '更新后的分类信息',
    })
    @ApiErrorResponses()
    async updateCategory(
        @Param('id') id: string,
        @Body() body: UpdateAdminServiceCategoryInput,
    ) {
        return this.service.updateCategory(id, body);
    }

    @Delete(':id')
    @UsePipes(
        createMultiZodPipe({
            params: CategoryIdSchema,
        }),
    )
    @ApiOperation({
        summary: '删除服务分类',
        description: '删除前需确保无子分类和关联服务',
    })
    @ApiParam({ name: 'id', description: '分类 ID' })
    @ApiSuccessResponse(
        z.object({
            success: z.boolean(),
        }),
        {
            description: '删除结果',
        },
    )
    @ApiErrorResponses()
    async deleteCategory(@Param('id') id: string) {
        return this.service.deleteCategory(id);
    }
}
