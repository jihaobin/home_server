import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    AdminServiceTagListQuery,
    AdminServiceTagListQuerySchema,
    AdminServiceTagListResponseSchema,
    AdminServiceTagSchema,
    CreateAdminServiceTagInput,
    CreateAdminServiceTagSchema,
    UpdateAdminServiceTagInput,
    UpdateAdminServiceTagSchema,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { createMultiZodPipe, ZodValidationPipe } from 'src/common/pipes';
import { z } from 'zod/v4';
import { AdminServiceTagsService } from './admin-service-tags.service';

const ServiceTagIdSchema = z
    .string()
    .max(255)
    .min(1, 'ID不能为空')
    .describe('服务标签 ID');

@ApiTags('管理员-服务标签')
@Controller('admin/service-tags')
export class AdminServiceTagsController {
    constructor(private readonly service: AdminServiceTagsService) {}

    @Get()
    @UsePipes(new ZodValidationPipe(AdminServiceTagListQuerySchema))
    @ApiOperation({
        summary: '获取服务标签列表',
        description: '支持按业务域、关键字和状态筛选',
    })
    @ApiSuccessResponse(AdminServiceTagListResponseSchema, {
        description: '服务标签列表',
    })
    @ApiErrorResponses()
    async listTags(@Query() query: AdminServiceTagListQuery) {
        return this.service.listTags(query);
    }

    @Post()
    @UsePipes(new ZodValidationPipe(CreateAdminServiceTagSchema))
    @ApiOperation({
        summary: '创建服务标签',
        description: '创建指定业务域下的服务标签',
    })
    @ApiBodies(CreateAdminServiceTagSchema)
    @ApiSuccessResponse(AdminServiceTagSchema, {
        description: '创建后的服务标签',
    })
    @ApiErrorResponses()
    async createTag(@Body() body: CreateAdminServiceTagInput) {
        return this.service.createTag(body);
    }

    @Patch(':id')
    @UsePipes(
        createMultiZodPipe({
            params: ServiceTagIdSchema,
            body: UpdateAdminServiceTagSchema,
        }),
    )
    @ApiOperation({
        summary: '更新服务标签',
        description: '更新标签名称、slug、排序、描述和启停状态',
    })
    @ApiParam({ name: 'id', description: '服务标签 ID' })
    @ApiBodies(UpdateAdminServiceTagSchema)
    @ApiSuccessResponse(AdminServiceTagSchema, {
        description: '更新后的服务标签',
    })
    @ApiErrorResponses()
    async updateTag(
        @Param('id') id: string,
        @Body() body: UpdateAdminServiceTagInput,
    ) {
        return this.service.updateTag(id, body);
    }

    @Delete(':id')
    @UsePipes(
        createMultiZodPipe({
            params: ServiceTagIdSchema,
        }),
    )
    @ApiOperation({
        summary: '删除服务标签',
        description: '删除前需确保没有服务引用该标签',
    })
    @ApiParam({ name: 'id', description: '服务标签 ID' })
    @ApiSuccessResponse(
        z.object({
            success: z.boolean(),
        }),
        {
            description: '删除结果',
        },
    )
    @ApiErrorResponses()
    async deleteTag(@Param('id') id: string) {
        return this.service.deleteTag(id);
    }
}
