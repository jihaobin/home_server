import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
    AdminRevenueLogListQuerySchema,
    AdminRevenueLogListResponseSchema,
    type AdminRevenueLogListQuery,
} from '@repo/types';

import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';

import { ZodValidationPipe } from 'src/common/pipes';

import { AuthGuard } from '../auth/auth.guard';

import { Roles } from '../auth/decorators';

import { AdminRevenueLogsService } from './admin-revenue-logs.service';

@ApiTags('管理员收益流水')
@Controller('admin/revenue-logs')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminRevenueLogsController {
    constructor(private readonly revenueLogsService: AdminRevenueLogsService) {}

    @Get()
    @ApiOperation({
        summary: '分页查询平台收益流水',

        description: '按时间、类型、金额区间筛选平台收益与支出记录。',
    })
    @ApiSuccessResponse(AdminRevenueLogListResponseSchema, {
        description: '收益流水分页结果',
    })
    @ApiErrorResponses()
    listRevenueLogs(
        @Query(new ZodValidationPipe(AdminRevenueLogListQuerySchema))
        query: AdminRevenueLogListQuery,
    ) {
        return this.revenueLogsService.listRevenueLogs(query);
    }
}
