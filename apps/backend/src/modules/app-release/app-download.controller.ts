import {
    Controller,
    Get,
    Header,
    NotFoundException,
    Param,
    UseGuards,
    Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
    AppLatestApkDownloadParamsSchema,
    type AppLatestApkDownloadParams,
} from '@repo/types';
import { ApiErrorResponses } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators';
import { AppReleaseService } from './app-release.service';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';

@ApiTags('应用更新')
@Controller('file/apk')
@UseGuards(AuthGuard)
export class AppDownloadController {
    constructor(
        private readonly service: AppReleaseService,
        private readonly s3: S3StoreServer,
    ) {}

    @Get(':app')
    @Public()
    @Header('Cache-Control', 'no-store')
    @ApiOperation({
        summary: '下载最新 APK（免登录长链，直接返回文件流）',
        description:
            '根据 app 标识返回当前可下载的最新 Android 版本文件流；若当前版本被禁用则自动回退到上一可用版本。',
    })
    @ApiErrorResponses()
    async downloadLatestApk(
        @Param(new ZodValidationPipe(AppLatestApkDownloadParamsSchema))
        params: AppLatestApkDownloadParams,
        @Res() res: Response,
    ) {
        res.setHeader('Cache-Control', 'no-store');

        const release =
            (await this.service.getActiveRelease(params.app, 'android')) ??
            null;

        if (!release) {
            throw new NotFoundException('暂无可下载的 APK 版本');
        }

        // iOS/TestFlight 场景不会走到这里，但若存在覆盖链接则直接 302
        if (release.downloadUrlOverride) {
            await this.service.recordDownload(release.id);
            res.redirect(release.downloadUrlOverride);
            return;
        }

        if (!release.file) {
            throw new NotFoundException('版本文件不存在或已被移除');
        }

        const objectStream = await this.s3.getObject(
            release.file.bucketName,
            release.file.objectPath,
        );

        const filename =
            release.file.originalName ||
            `${release.app}-${release.version}.apk`;

        res.set({
            'Content-Type':
                release.file.mimeType ||
                'application/vnd.android.package-archive',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': String(release.file.fileSize),
            'Accept-Ranges': 'bytes',
        });

        await this.service.recordDownload(release.id);

        objectStream.pipe(res);
    }
}
