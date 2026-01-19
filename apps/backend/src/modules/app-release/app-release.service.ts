import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import * as semver from 'semver';

import type {
    AppReleaseRecord,
    AppReleaseWithFile,
} from './app-release.repository';
import {
    AppReleaseRepository,
    type AppReleaseApp,
    type AppReleaseChannel,
    type AppReleasePlatform,
    type AppReleaseStatus,
} from './app-release.repository';
import { FilesService } from '../files/files.service';

export interface CreateAppReleaseInput {
    app: AppReleaseApp;
    platform: AppReleasePlatform;
    version: string;
    buildNumber?: number | null;
    forceUpdate?: boolean;
    minSupportedVersion?: string | null;
    changelog?: string | null;
    releaseStatus?: AppReleaseStatus;
    isActive?: boolean;
    downloadUrlOverride?: string | null;
    fileId?: string | null;
    releaseChannel?: AppReleaseChannel;
    rolloutPercent?: number | null;
    rollbackFromId?: string | null;
    createdBy: string;
    publishedBy?: string | null;
    publishedAt?: Date | null;
}

export interface UpdateAppReleaseInput {
    releaseId: string;
    operatorId: string;
    payload: Partial<{
        forceUpdate: boolean;
        minSupportedVersion: string | null;
        changelog: string | null;
        releaseStatus: AppReleaseStatus;
        isActive: boolean;
        downloadUrlOverride: string | null;
        releaseChannel: AppReleaseChannel;
        rolloutPercent: number | null;
        rollbackFromId: string | null;
        fileId: string | null;
        buildNumber: number | null;
        publishedAt: Date | null;
        publishedBy: string | null;
    }>;
}

export interface ListAppReleaseParams {
    app?: AppReleaseApp;
    platform?: AppReleasePlatform;
    status?: AppReleaseStatus;
    isActive?: boolean;
}

@Injectable()
export class AppReleaseService {
    constructor(
        private readonly repository: AppReleaseRepository,
        private readonly filesService: FilesService,
    ) {}

    private readonly presignTtl =
        Number(process.env.APP_UPDATE_PRESIGN_TTL ?? 600) || 600;

    private assertSemver(version: string, field: string) {
        if (!semver.valid(version)) {
            throw new BadRequestException(
                `${field} 必须是有效的 semver 版本号`,
            );
        }
    }

    private async buildDownloadUrl(
        release: AppReleaseWithFile,
    ): Promise<string | null> {
        // isActive 用于控制对外下载能力
        if (!release.isActive) {
            return null;
        }
        if (release.downloadUrlOverride) {
            return release.downloadUrlOverride;
        }
        if (!release.file) {
            return null;
        }
        return this.filesService.getPresignedDownloadUrl(
            release.file.id,
            this.presignTtl,
        );
    }

    private async ensureVersionUnique(
        app: AppReleaseApp,
        platform: AppReleasePlatform,
        version: string,
        excludeId?: string,
    ) {
        const existing = await this.repository.findByVersion(
            app,
            platform,
            version,
        );

        if (existing && existing.id !== excludeId) {
            throw new BadRequestException(
                '同一应用与平台下该版本号已存在，请调整后再试',
            );
        }
    }

    async createRelease(input: CreateAppReleaseInput) {
        this.assertSemver(input.version, 'version');

        if (input.minSupportedVersion) {
            this.assertSemver(input.minSupportedVersion, 'minSupportedVersion');
            if (semver.gt(input.minSupportedVersion, input.version)) {
                throw new BadRequestException(
                    'minSupportedVersion 不能高于当前版本',
                );
            }
        }

        if (!input.fileId && !input.downloadUrlOverride) {
            throw new BadRequestException(
                '缺少 fileId 或 downloadUrlOverride，至少提供其一',
            );
        }

        if (input.fileId) {
            await this.filesService.getFileById(input.fileId);
        }

        await this.ensureVersionUnique(
            input.app,
            input.platform,
            input.version,
        );

        // 发布状态、渠道、灰度暂时固定，后续如需恢复再开放配置
        const releaseStatus: AppReleaseStatus = 'published';

        const publishedAt =
            releaseStatus === 'published'
                ? (input.publishedAt ?? new Date())
                : null;
        const publishedBy =
            releaseStatus === 'published'
                ? (input.publishedBy ?? input.createdBy)
                : null;

        const rolloutPercent = 100;

        const record = await this.repository.createRelease({
            app: input.app,
            platform: input.platform,
            version: input.version,
            buildNumber: input.buildNumber ?? null,
            forceUpdate: input.forceUpdate ?? false,
            minSupportedVersion: input.minSupportedVersion ?? null,
            changelog: input.changelog ?? null,
            releaseStatus,
            isActive: input.isActive ?? true,
            downloadUrlOverride: input.downloadUrlOverride ?? null,
            fileId: input.fileId ?? null,
            createdBy: input.createdBy,
            publishedBy,
            publishedAt,
            rollbackFromId: input.rollbackFromId ?? null,
            releaseChannel: 'production',
            rolloutPercent,
            downloadCount: 0,
            forceUpdateCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return record;
    }

    async updateRelease(input: UpdateAppReleaseInput) {
        const existing = await this.repository.findById(input.releaseId);
        if (!existing) {
            throw new NotFoundException('应用版本不存在');
        }

        if (
            input.payload.minSupportedVersion !== undefined &&
            input.payload.minSupportedVersion !== null
        ) {
            this.assertSemver(
                input.payload.minSupportedVersion,
                'minSupportedVersion',
            );
            if (
                semver.gt(input.payload.minSupportedVersion, existing.version)
            ) {
                throw new BadRequestException(
                    'minSupportedVersion 不能高于当前版本',
                );
            }
        }

        if (input.payload.fileId) {
            await this.filesService.getFileById(input.payload.fileId);
        }

        // 发布状态、渠道、灰度暂时固定，保持现有值或默认
        const nextStatus: AppReleaseStatus =
            existing.releaseStatus ?? 'published';

        const { rolloutPercent, ...restPayload } = input.payload;
        // 灰度比例暂固定为 100，不随表单更新
        const normalizedRollout = rolloutPercent === null ? undefined : 100;

        const publishedAt =
            nextStatus === 'published'
                ? (input.payload.publishedAt ??
                  existing.publishedAt ??
                  new Date())
                : null;
        const publishedBy =
            nextStatus === 'published'
                ? (input.payload.publishedBy ??
                  existing.publishedBy ??
                  input.operatorId)
                : null;

        const updatePayload: Partial<AppReleaseRecord> = {
            ...restPayload,
            releaseStatus: nextStatus,
            isActive: input.payload.isActive ?? existing.isActive,
            releaseChannel: 'production',
            publishedAt,
            publishedBy,
            updatedAt: new Date(),
        };

        if (normalizedRollout !== undefined) {
            updatePayload.rolloutPercent = normalizedRollout;
        }

        const updated = await this.repository.updateRelease(
            input.releaseId,
            updatePayload,
        );

        if (!updated) {
            throw new NotFoundException('应用版本不存在');
        }

        return updated;
    }

    async rollbackRelease(params: { releaseId: string; operatorId: string }) {
        const target = await this.repository.findById(params.releaseId);
        if (!target) {
            throw new NotFoundException('应用版本不存在');
        }

        await this.repository.updateRelease(
            target.id,
            {
                releaseStatus: 'rollbacked',
                isActive: false,
                updatedAt: new Date(),
                rollbackFromId: target.rollbackFromId ?? null,
            },
            { activate: false },
        );

        const previous = await this.repository.findLatestPublished(
            target.app,
            target.platform,
        );

        if (previous && previous.id !== target.id) {
            await this.repository.updateRelease(
                previous.id,
                {
                    isActive: true,
                    releaseStatus: 'published',
                    updatedAt: new Date(),
                },
                { activate: true },
            );
        }

        const refreshed = await this.repository.findById(target.id);
        return refreshed;
    }

    async listReleases(params: ListAppReleaseParams) {
        const records = await this.repository.listReleases(params);
        const withUrls = await Promise.all(
            records.map(async (item) => ({
                ...item,
                downloadUrl: await this.buildDownloadUrl(item),
            })),
        );
        return withUrls;
    }

    async getReleaseWithUrl(id: string) {
        const release = await this.getReleaseOrThrow(id);
        const downloadUrl = await this.buildDownloadUrl(release);
        return { ...release, downloadUrl };
    }

    async getReleaseOrThrow(id: string): Promise<AppReleaseWithFile> {
        const release = await this.repository.findById(id);
        if (!release) {
            throw new NotFoundException('应用版本不存在');
        }
        return release;
    }

    async getActiveRelease(app: AppReleaseApp, platform: AppReleasePlatform) {
        return this.repository.getActiveRelease(app, platform);
    }

    async getLatestDownloadableRelease(params: {
        app: AppReleaseApp;
        platform: AppReleasePlatform;
    }): Promise<{ release: AppReleaseWithFile; downloadUrl: string } | null> {
        const release = await this.repository.getActiveRelease(
            params.app,
            params.platform,
        );

        if (!release) {
            return null;
        }

        const downloadUrl = await this.buildDownloadUrl(release);

        if (!downloadUrl) {
            return null;
        }

        return { release, downloadUrl };
    }

    async recordDownload(
        releaseId: string,
        options?: { forceUpdate?: boolean },
    ) {
        const updated = await this.repository.incrementDownloadCount(
            releaseId,
            options,
        );
        if (!updated) {
            throw new NotFoundException('应用版本不存在');
        }
        return updated;
    }

    async checkForUpdate(params: {
        app: AppReleaseApp;
        platform: AppReleasePlatform;
        currentVersion: string;
    }) {
        this.assertSemver(params.currentVersion, 'currentVersion');

        const active =
            (await this.repository.getActiveRelease(
                params.app,
                params.platform,
            )) ??
            (await this.repository.findLatestPublished(
                params.app,
                params.platform,
            ));

        if (!active) {
            return {
                latestVersion: null,
                forceUpdate: false,
                requireUpdate: false,
                optionalUpdate: false,
                downloadUrl: null,
                changelog: null,
                size: null,
                hash: null,
            };
        }

        const downloadUrl = await this.buildDownloadUrl(active);
        const minSupported = active.minSupportedVersion ?? undefined;
        const isBelowMin =
            !!minSupported &&
            semver.valid(minSupported) &&
            semver.lt(params.currentVersion, minSupported);
        const requireUpdate = active.forceUpdate || isBelowMin;
        const optionalUpdate =
            !requireUpdate && semver.lt(params.currentVersion, active.version);

        return {
            latestVersion: active.version,
            forceUpdate: !!active.forceUpdate,
            minSupportedVersion: active.minSupportedVersion,
            requireUpdate,
            optionalUpdate,
            downloadUrl,
            changelog: active.changelog ?? null,
            size: active.file?.fileSize ?? null,
            hash: active.file?.fileHash ?? null,
            rollbackHint: active.releaseStatus === 'rollbacked',
        };
    }
}
