import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
    AdminLoginRequest,
    AdminLoginRequestSchema,
    AdminLogoutResponseSchema,
    AdminProfileSchema,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { Public, Roles } from '../auth/decorators';
import { AdminAuthService } from './admin-auth.service';
import type { AdminRequestContext } from '../auth/admin-session.middleware';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('管理员认证')
@Controller('admin')
export class AdminAuthController {
    constructor(private readonly adminAuthService: AdminAuthService) {}

    @Post('login')
    @Public()
    @UsePipes(new ZodValidationPipe(AdminLoginRequestSchema))
    @ApiOperation({
        summary: '管理员登录',
        description: '仅允许 admin/super_admin 角色登录管理后台',
    })
    @ApiSuccessResponse(AdminProfileSchema, {
        description: '返回管理员基础资料并写入 Session Cookie',
    })
    @ApiErrorResponses()
    async login(
        @Body() payload: AdminLoginRequest,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.adminAuthService.login(payload);
        this.forwardAuthHeaders(res, result.headers);
        return result.profile;
    }

    @Post('logout')
    @UseGuards(AuthGuard)
    @Roles(['admin', 'super_admin'])
    @ApiOperation({
        summary: '退出管理员登录',
        description: '清除当前会话 Cookie，并失效数据库会话',
    })
    @ApiSuccessResponse(AdminLogoutResponseSchema, {
        description: '返回登出状态',
    })
    @ApiErrorResponses()
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.adminAuthService.logout(req);
        this.forwardAuthHeaders(res, result.headers);
        return result.response;
    }

    @Get('profile')
    @UseGuards(AuthGuard)
    @Roles(['admin', 'super_admin'])
    @ApiOperation({
        summary: '获取管理员 Profile',
        description: '在会话有效时返回管理员基础资料',
    })
    @ApiSuccessResponse(AdminProfileSchema, {
        description: '返回登录管理员的基础信息',
    })
    @ApiErrorResponses()
    profile(@Req() req: Request) {
        return this.adminAuthService.getProfileFromContext(
            (req as Request & { admin?: AdminRequestContext }).admin,
        );
    }

    private forwardAuthHeaders(res: Response, headers?: Headers) {
        if (!headers) return;

        const setCookie: string[] = [];
        headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
                setCookie.push(value);
                return;
            }

            res.setHeader(key, value);
        });

        if (setCookie.length > 0) {
            res.setHeader('set-cookie', setCookie);
        }
    }
}
