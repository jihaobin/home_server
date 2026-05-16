import {
    Body,
    Controller,
    Get,
    Post,
    Put,
    Param,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    ServiceDetailsSchema,
    ServicePersonnelDetailsQuerySchema,
    type ServicePersonnelFilterRequest,
    ServicePersonnelFilterRequestSchema,
    ServicePersonnelFilterResponseSchema,
    ServicePersonnelProfileSchema,
    ServicePersonnelDashboardStatsSchema,
    UpdateServicePersonnelProfileRequestSchema,
    type UpdateServicePersonnelProfileRequest,
    UserRoleEnum,
} from '@repo/types';
import { Request } from 'express';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { z } from 'zod/v4';
import { AuthGuard } from '../auth/auth.guard';
import { AuthOptional, Roles } from '../auth/decorators';
import { ServicePersonnelService } from './service-personnel.service';
import { upgradeToServicePersonnel as applyServicePersonnelUpgrade } from 'auth';

@ApiTags('服务人员管理')
@Controller('service-personnel')
export class ServicePersonnelController {
    constructor(
        private readonly servicePersonnelService: ServicePersonnelService,
    ) {}

    @Post('upgrade')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: '申请成为服务人员',
        description:
            '为当前已登录用户添加服务人员权限，并初始化服务人员档案（如未存在）',
    })
    @ApiSuccessResponse(
        z.object({
            roles: z.array(UserRoleEnum),
        }),
        {
            description: '成功申请服务人员权限',
        },
    )
    @ApiErrorResponses()
    async upgradeToServicePersonnel(@Req() req: Request) {
        const roles = await applyServicePersonnelUpgrade(
            req.user.id,
            req.user.role,
        );
        return {
            roles,
        };
    }

    @Get('search')
    @UseGuards(AuthGuard)
    @AuthOptional()
    @UsePipes(
        new ZodValidationPipe(
            ServicePersonnelFilterRequestSchema.omit({ currentUserId: true }),
        ),
    )
    @ApiOperation({
        summary: '智能筛选服务人员',
        description: `
根据地理位置、价格区间、服务类型等条件智能匹配服务人员。

**认证模式：**
- 🔓 可选认证：未登录用户也可以搜索
- 🔐 已登录用户：自动排除自己在搜索结果中

**核心功能：**
- ✅ 技能匹配：只返回掌握指定服务的人员
- ✅ 地理位置筛选：基于用户位置和最大距离
- ✅ 价格区间筛选：支持个人定价筛选
- ✅ 时间可用性检查：验证工作时间和工作日
- ✅ 服务半径验证：检查用户是否在服务范围内
- ✅ 多维度排序：距离、价格、经验、评分
- ✅ 分页支持：支持大量数据的分页展示

**匹配逻辑：**
1. 首先筛选掌握所需服务技能的人员
2. 检查地理位置是否在搜索范围内
3. 验证价格区间（如果指定）
4. 检查时间可用性（如果指定服务时间）
5. 验证服务人员当前状态
6. 如果用户已登录，排除当前登录用户自己
7. 按指定方式排序并分页返回

**智能特性：**
- 自动计算距离和服务半径覆盖
- 实时工作时间匹配
- 综合评分排序（未来支持）
        `,
    })
    @ApiQueries(
        ServicePersonnelFilterRequestSchema.omit({ currentUserId: true }),
    )
    @ApiSuccessResponse(ServicePersonnelFilterResponseSchema, {
        description: '成功获取匹配的服务人员列表',
        isPaginated: true,
    })
    @ApiErrorResponses()
    async searchPersonnel(
        @Query() query: ServicePersonnelFilterRequest,
        @Req() req: Request,
    ) {
        return await this.servicePersonnelService.findMatchedPersonnel({
            ...query,
            currentUserId: req.user?.id, // 传递当前用户ID用于排除自己
        });
    }

    @Get('profile/me')
    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @ApiOperation({
        summary: '获取当前服务人员自己的聚合资料',
        description:
            '用于服务人员端管理页面，包含已下架、待审核、审核未通过等 owner 可见服务状态。',
    })
    @ApiSuccessResponse(ServicePersonnelProfileSchema, {
        description: '当前服务人员聚合资料',
    })
    @ApiErrorResponses()
    async getOwnPersonnelProfile(@Req() req: Request) {
        return await this.servicePersonnelService.getOwnPersonnelProfile(
            req.user.id,
        );
    }

    @Get('profile/:personnelId')
    @ApiOperation({
        summary: '聚合获取服务人员资料',
        description:
            '整合同一服务人员的基础资料、技能/定价与文件信息，返回一次即可渲染详情页的数据。',
    })
    @ApiParam({
        name: 'personnelId',
        description: '服务人员用户ID',
    })
    @ApiSuccessResponse(ServicePersonnelProfileSchema, {
        description: '服务人员聚合资料',
    })
    @ApiErrorResponses()
    async getPersonnelProfile(@Param('personnelId') personnelId: string) {
        return await this.servicePersonnelService.getPersonnelProfile(
            personnelId,
        );
    }

    @Put('profile')
    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @UsePipes(new ZodValidationPipe(UpdateServicePersonnelProfileRequestSchema))
    @ApiOperation({
        summary: '更新服务人员基础资料',
        description: '更新当前服务人员的名称与头像（头像存文件 hash）',
    })
    @ApiSuccessResponse(z.object({ success: z.boolean() }), {
        description: '更新成功',
    })
    @ApiErrorResponses()
    async updateProfile(
        @Body() payload: UpdateServicePersonnelProfileRequest,
        @Req() req: Request,
    ) {
        await this.servicePersonnelService.updatePersonnelProfile(
            req.user.id,
            payload,
        );
        return { success: true };
    }

    @Get('getServiceDetails')
    @ApiErrorResponses()
    @ApiOperation({
        summary: '获取服务人员的具体服务详情',
        description: `
根据服务人员ID和服务ID，获取该服务人员提供的具体服务详情，包括服务描述、价格、可用时间等信息。
        `,
    })
    @UsePipes(new ZodValidationPipe(ServicePersonnelDetailsQuerySchema))
    @ApiQueries(ServicePersonnelDetailsQuerySchema)
    @ApiSuccessResponse(ServiceDetailsSchema, {
        description: '服务详情',
    })
    async getServiceDetails(
        @Query() query: { serviceId: string; personnelId: string },
    ) {
        return await this.servicePersonnelService.getPersonnelServiceDetails({
            personnelId: query.personnelId,
            serviceId: query.serviceId,
        });
    }

    @Get('dashboard/me')
    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @ApiOperation({
        summary: '获取我的服务统计',
        description: '返回服务次数、评分与余额，用于个人中心展示',
    })
    @ApiSuccessResponse(ServicePersonnelDashboardStatsSchema, {
        description: '服务人员个人中心统计',
    })
    @ApiErrorResponses()
    async getDashboardStats(@Req() req: Request) {
        return await this.servicePersonnelService.getPersonnelDashboardStats(
            req.user.id,
        );
    }
}
