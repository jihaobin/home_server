import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminDashboardOverviewQuerySchema,
    AdminDashboardOverviewSchema,
    type AdminDashboardOverviewQuery,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('管理员仪表盘')
@Controller('admin/dashboard')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminDashboardController {
    constructor(private readonly dashboardService: AdminDashboardService) {}

    @Get('overview')
    @ApiOperation({
        summary: '获取仪表盘统计',
        description:
            '返回平台注册用户、服务人员、收益等核心指标，并提供趋势图数据',
    })
    @ApiSuccessResponse(AdminDashboardOverviewSchema, {
        description: '仪表盘核心指标与趋势图数据',
    })
    @ApiErrorResponses()
    getOverview(
        @Query(new ZodValidationPipe(AdminDashboardOverviewQuerySchema))
        query: AdminDashboardOverviewQuery,
    ) {
        return this.dashboardService.getOverview(query.range);
    }
}
