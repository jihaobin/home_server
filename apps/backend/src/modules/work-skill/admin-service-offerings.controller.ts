import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    AdminServiceOfferingListQuery,
    AdminServiceOfferingListQuerySchema,
    AdminServiceOfferingListResponseSchema,
    AdminServiceOfferingReason,
    AdminServiceOfferingReasonSchema,
} from '@repo/types';
import { z } from 'zod/v4';

import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { createMultiZodPipe, ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminServiceOfferingsService } from './admin-service-offerings.service';

const IdParamSchema = z.string().min(1, 'ID不能为空').max(255);

const TakeDownParamsSchema = z.object({
    personnelId: z.string().min(1, '服务人员用户ID不能为空').max(255),
    serviceId: z.string().min(1, '服务ID不能为空').max(255),
});

const OperationResultSchema = z.object({
    success: z.boolean(),
});

@ApiTags('管理员-服务上架审核')
@Controller('admin/service-offerings')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminServiceOfferingsController {
    constructor(private readonly service: AdminServiceOfferingsService) {}

    @Get()
    @ApiOperation({ summary: '查询服务上架审核列表' })
    @ApiSuccessResponse(AdminServiceOfferingListResponseSchema, {
        description: '服务上架审核统一列表',
    })
    @ApiErrorResponses()
    async list(
        @Query(new ZodValidationPipe(AdminServiceOfferingListQuerySchema))
        query: AdminServiceOfferingListQuery,
    ) {
        return this.service.list(query);
    }

    @Post('drafts/:id/approve')
    @ApiOperation({ summary: '通过服务上架审核' })
    @ApiParam({ name: 'id', description: '草稿 ID' })
    @ApiSuccessResponse(OperationResultSchema)
    @ApiErrorResponses()
    async approveDraft(
        @Param('id', new ZodValidationPipe(IdParamSchema)) id: string,
        @Req() req: any,
    ) {
        await this.service.approveDraft(id, req.user.id);
        return { success: true };
    }

    @Post('drafts/:id/reject')
    @ApiOperation({ summary: '拒绝服务上架审核' })
    @ApiParam({ name: 'id', description: '草稿 ID' })
    @ApiSuccessResponse(OperationResultSchema)
    @ApiErrorResponses()
    async rejectDraft(
        @Param('id', new ZodValidationPipe(IdParamSchema)) id: string,
        @Body(new ZodValidationPipe(AdminServiceOfferingReasonSchema))
        body: AdminServiceOfferingReason,
        @Req() req: any,
    ) {
        await this.service.rejectDraft(id, req.user.id, body.reason);
        return { success: true };
    }

    @Post(':personnelId/:serviceId/take-down')
    @ApiOperation({ summary: '下架服务人员服务项' })
    @ApiParam({ name: 'personnelId', description: '服务人员用户 ID' })
    @ApiParam({ name: 'serviceId', description: '服务 ID' })
    @ApiSuccessResponse(OperationResultSchema)
    @ApiErrorResponses()
    async takeDownOffering(
        @Param(createMultiZodPipe({ params: TakeDownParamsSchema }))
        params: { personnelId: string; serviceId: string },
        @Body(new ZodValidationPipe(AdminServiceOfferingReasonSchema))
        body: AdminServiceOfferingReason,
        @Req() req: any,
    ) {
        await this.service.takeDownOffering(
            params.personnelId,
            params.serviceId,
            req.user.id,
            body.reason,
        );
        return { success: true };
    }
}
