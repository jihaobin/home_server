import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminReviewWithdrawalBodySchema,
    AdminWithdrawalListQuerySchema,
    AdminWithdrawalListResponseSchema,
    AdminWithdrawalSchema,
    type AdminReviewWithdrawalBody,
    type AdminWithdrawalListQuery,
} from '@repo/types';
import type { Request } from 'express';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminWithdrawalsService } from './admin-withdrawals.service';

@ApiTags('管理员提现审核')
@Controller('admin/withdrawals')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminWithdrawalsController {
    constructor(private readonly withdrawalsService: AdminWithdrawalsService) {}

    @Get()
    @ApiOperation({
        summary: '查询提现申请',
        description:
            '按照申请时间、金额区间、状态、关键词筛选服务人员提现记录。',
    })
    @ApiSuccessResponse(AdminWithdrawalListResponseSchema, {
        description: '提现记录分页数据',
    })
    @ApiErrorResponses()
    listWithdrawals(
        @Query(new ZodValidationPipe(AdminWithdrawalListQuerySchema))
        query: AdminWithdrawalListQuery,
    ) {
        return this.withdrawalsService.listWithdrawals(query);
    }

    @Patch(':withdrawalId')
    @ApiOperation({
        summary: '审核提现申请',
        description:
            '支持审核通过后触发渠道打款，或驳回提现申请；审核通过不代表渠道已完成打款。',
    })
    @ApiSuccessResponse(AdminWithdrawalSchema, {
        description: '更新后的提现记录',
    })
    @ApiErrorResponses()
    reviewWithdrawal(
        @Param('withdrawalId') withdrawalId: string,
        @Body(new ZodValidationPipe(AdminReviewWithdrawalBodySchema))
        payload: AdminReviewWithdrawalBody,
        @Req() req: Request,
    ) {
        const adminId = req.user?.id;
        if (!adminId) {
            throw new BadRequestException('缺少管理员身份信息');
        }
        return this.withdrawalsService.reviewWithdrawal(
            withdrawalId,
            adminId,
            payload,
        );
    }
}
