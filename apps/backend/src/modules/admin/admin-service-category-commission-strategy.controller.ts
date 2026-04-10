import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Put,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
    AdminCommissionStrategyDetailSchema,
    AdminCommissionStrategyPublishInputSchema,
    AdminCommissionStrategySimulationInput,
    AdminCommissionStrategySimulationInputSchema,
    AdminCommissionStrategySimulationResultSchema,
    SaveAdminCommissionStrategyDraftInput,
    SaveAdminCommissionStrategyDraftSchema,
} from '@repo/types';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import type { AdminRequestContext } from '../auth/admin-session.middleware';
import { AdminServiceCategoryCommissionStrategyService } from './admin-service-category-commission-strategy.service';

@ApiTags('管理员-服务分类抽成策略')
@Controller('admin/service-categories/:categoryId/commission-strategy')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminServiceCategoryCommissionStrategyController {
    constructor(
        private readonly service: AdminServiceCategoryCommissionStrategyService,
    ) {}

    @Get()
    @ApiOperation({
        summary: '获取服务分类抽成策略详情',
        description: '返回分类固定抽成、当前草稿与已发布版本',
    })
    @ApiParam({ name: 'categoryId', description: '服务分类 ID' })
    @ApiSuccessResponse(AdminCommissionStrategyDetailSchema)
    @ApiErrorResponses()
    async getDetail(@Param('categoryId') categoryId: string) {
        return await this.service.getStrategyDetail(categoryId);
    }

    @Put('draft')
    @ApiOperation({
        summary: '保存抽成策略草稿',
        description: '编辑始终发生在草稿版本；无草稿时自动创建新草稿',
    })
    @ApiParam({ name: 'categoryId', description: '服务分类 ID' })
    @ApiBodies(SaveAdminCommissionStrategyDraftSchema)
    @ApiSuccessResponse(AdminCommissionStrategyDetailSchema)
    @ApiErrorResponses()
    async saveDraft(
        @Param('categoryId') categoryId: string,
        @Body(new ZodValidationPipe(SaveAdminCommissionStrategyDraftSchema))
        body: SaveAdminCommissionStrategyDraftInput,
        @Req() req: Request,
    ) {
        this.assertCategoryIdMatches(categoryId, body.categoryId);

        return await this.service.saveDraft({
            categoryId,
            operatorId: this.getOperatorId(req),
            payload: body,
        });
    }

    @Post('publish')
    @ApiOperation({
        summary: '发布当前草稿',
        description: '将当前草稿版本发布为生效版本，并更新策略主表状态',
    })
    @ApiParam({ name: 'categoryId', description: '服务分类 ID' })
    @ApiBodies(AdminCommissionStrategyPublishInputSchema)
    @ApiSuccessResponse(AdminCommissionStrategyDetailSchema)
    @ApiErrorResponses()
    async publishDraft(
        @Param('categoryId') categoryId: string,
        @Body(new ZodValidationPipe(AdminCommissionStrategyPublishInputSchema))
        body: {
            categoryId: string;
            publishReason?: string;
        },
        @Req() req: Request,
    ) {
        this.assertCategoryIdMatches(categoryId, body.categoryId);

        return await this.service.publishDraft({
            categoryId,
            publishReason: body.publishReason,
            operatorId: this.getOperatorId(req),
        });
    }

    @Post('simulate')
    @ApiOperation({
        summary: '试算抽成策略命中结果',
        description: '基于已发布版本试算当前条件下的命中规则与抽成比例',
    })
    @ApiParam({ name: 'categoryId', description: '服务分类 ID' })
    @ApiBodies(AdminCommissionStrategySimulationInputSchema)
    @ApiSuccessResponse(AdminCommissionStrategySimulationResultSchema)
    @ApiErrorResponses()
    async simulate(
        @Param('categoryId') categoryId: string,
        @Body(
            new ZodValidationPipe(AdminCommissionStrategySimulationInputSchema),
        )
        body: AdminCommissionStrategySimulationInput,
    ) {
        this.assertCategoryIdMatches(categoryId, body.categoryId);
        return await this.service.simulate(body);
    }

    private assertCategoryIdMatches(
        pathCategoryId: string,
        bodyCategoryId: string,
    ) {
        if (pathCategoryId !== bodyCategoryId) {
            throw new BadRequestException('请求路径与 body.categoryId 不一致');
        }
    }

    private getOperatorId(req: Request): string {
        const adminContext = (req as Request & { admin?: AdminRequestContext })
            .admin;

        if (!adminContext?.id) {
            throw new UnauthorizedException('管理员上下文缺失');
        }

        return adminContext.id;
    }
}
