import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminAppReleaseListQuerySchema,
    AdminCreateAppReleaseSchema,
    AdminUpdateAppReleaseSchema,
    AppReleaseDetailSchema,
    AppReleaseListItemSchema,
    type AdminCreateAppRelease,
    type AdminUpdateAppRelease,
    type AdminAppReleaseListQuery,
} from '@repo/types';
import { ZodValidationPipe } from 'src/common/pipes';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AppReleaseService } from './app-release.service';

@ApiTags('管理员-应用版本')
@Controller('admin/app-releases')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminAppReleaseController {
    constructor(private readonly service: AppReleaseService) {}

    @Post()
    @ApiOperation({
        summary: '上传并创建应用版本',
        description: '先通过文件服务上传获取 fileId，再绑定到版本记录',
    })
    @ApiSuccessResponse(AppReleaseDetailSchema, {
        description: '创建后的版本信息，含下载链接',
    })
    @ApiErrorResponses()
    async createRelease(
        @Body(new ZodValidationPipe(AdminCreateAppReleaseSchema))
        body: AdminCreateAppRelease,
        @Req() req: any,
    ) {
        if (!body.fileId && !body.downloadUrlOverride) {
            throw new BadRequestException(
                '缺少 fileId 或 downloadUrlOverride，至少提供其一',
            );
        }

        if (!req?.user?.id) {
            throw new BadRequestException('无法获取当前管理员信息');
        }

        const release = await this.service.createRelease({
            ...body,
            fileId: body.fileId ?? null,
            releaseStatus: body.status,
            createdBy: req.user.id,
        });
        return this.service.getReleaseWithUrl(release.id);
    }

    @Get()
    @ApiOperation({
        summary: '查询应用版本列表',
    })
    @ApiSuccessResponse(AppReleaseListItemSchema, {
        isPaginated: false,
        description: '版本列表（含下载链接、文件信息）',
    })
    @ApiErrorResponses()
    async listReleases(
        @Query(new ZodValidationPipe(AdminAppReleaseListQuerySchema))
        query: AdminAppReleaseListQuery,
    ) {
        return this.service.listReleases(query);
    }

    @Get(':id')
    @ApiOperation({
        summary: '查看版本详情',
    })
    @ApiSuccessResponse(AppReleaseDetailSchema, {
        description: '版本详情（含下载链接、文件信息）',
    })
    @ApiErrorResponses()
    async getDetail(@Param('id') id: string) {
        return this.service.getReleaseWithUrl(id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: '更新版本配置',
        description: '支持修改强更、灰度比例、状态等',
    })
    @ApiSuccessResponse(AppReleaseDetailSchema, {
        description: '更新后的版本详情',
    })
    @ApiErrorResponses()
    async updateRelease(
        @Param('id') id: string,
        @Body(new ZodValidationPipe(AdminUpdateAppReleaseSchema))
        body: AdminUpdateAppRelease,
        @Req() req: any,
    ) {
        const updated = await this.service.updateRelease({
            releaseId: id,
            operatorId: req?.user?.id,
            payload: {
                forceUpdate: body.forceUpdate,
                minSupportedVersion: body.minSupportedVersion ?? null,
                changelog: body.changelog,
                releaseStatus: body.status,
                isActive: body.isActive,
                downloadUrlOverride: body.downloadUrlOverride,
                releaseChannel: body.releaseChannel,
                rolloutPercent: body.rolloutPercent,
                rollbackFromId: body.rollbackFromId,
                fileId: body.fileId,
                buildNumber: body.buildNumber ?? null,
                publishedAt: body.status === 'published' ? new Date() : null,
                publishedBy: req?.user?.id,
            },
        });
        const detail = await this.service.getReleaseWithUrl(updated.id);
        return detail;
    }

    @Post(':id/rollback')
    @ApiOperation({
        summary: '回滚到上一版本',
        description: '将指定版本标记为已回滚，并激活上一发布版本',
    })
    @ApiSuccessResponse(AppReleaseDetailSchema, {
        description: '回滚后的版本详情',
    })
    @ApiErrorResponses()
    async rollback(@Param('id') id: string, @Req() req: any) {
        return this.service.rollbackRelease({
            releaseId: id,
            operatorId: req?.user?.id,
        });
    }
}
