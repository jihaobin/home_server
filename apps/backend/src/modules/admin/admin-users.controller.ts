import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminUpdateUserRoleSchema,
    AdminUpdateUserStatusSchema,
    AdminUserDetailSchema,
    AdminUserListItemSchema,
    AdminUserListQuerySchema,
    type AdminUpdateUserRole,
    type AdminUpdateUserStatus,
    type AdminUserListQuery,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminUsersService } from './admin-users.service';

@ApiTags('管理员用户')
@Controller('admin/users')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminUsersController {
    constructor(private readonly adminUsersService: AdminUsersService) {}

    @Get()
    @ApiOperation({
        summary: '分页查询用户',
        description: '支持通过用户名、手机号、角色、状态进行组合筛选',
    })
    @ApiSuccessResponse(AdminUserListItemSchema, {
        isPaginated: true,
        description: '返回平台用户的分页数据',
    })
    @ApiErrorResponses()
    listUsers(
        @Query(new ZodValidationPipe(AdminUserListQuerySchema))
        query: AdminUserListQuery,
    ) {
        return this.adminUsersService.listUsers(query);
    }

    @Get(':id')
    @ApiOperation({
        summary: '查看用户详情',
        description: '返回基础资料与订单统计信息',
    })
    @ApiSuccessResponse(AdminUserDetailSchema, {
        description: '用户详情数据',
    })
    @ApiErrorResponses()
    getUserDetail(@Param('id') userId: string) {
        return this.adminUsersService.getUserDetail(userId);
    }

    @Patch(':id/status')
    @ApiOperation({
        summary: '更新用户启用状态',
        description: '用于冻结或解冻平台用户账户',
    })
    @ApiSuccessResponse(AdminUserDetailSchema, {
        description: '最新的用户详情数据',
    })
    @ApiErrorResponses()
    updateUserStatus(
        @Param('id') userId: string,
        @Body(new ZodValidationPipe(AdminUpdateUserStatusSchema))
        payload: AdminUpdateUserStatus,
    ) {
        return this.adminUsersService.updateUserStatus(userId, payload);
    }

    @Patch(':id/role')
    @ApiOperation({
        summary: '调整用户角色',
        description: '允许将用户切换为客服、运营或服务人员角色',
    })
    @ApiSuccessResponse(AdminUserDetailSchema, {
        description: '更新后的用户详情',
    })
    @ApiErrorResponses()
    updateUserRole(
        @Param('id') userId: string,
        @Body(new ZodValidationPipe(AdminUpdateUserRoleSchema))
        payload: AdminUpdateUserRole,
    ) {
        return this.adminUsersService.updateUserRole(userId, payload);
    }
}
