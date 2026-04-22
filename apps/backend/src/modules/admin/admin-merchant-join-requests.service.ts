import { Injectable, NotFoundException } from '@nestjs/common';
import type {
    AdminMerchantJoinRequest,
    AdminMerchantJoinRequestListQuery,
    AdminMerchantJoinRequestListResponse,
    AdminUpdateMerchantJoinRequest,
} from '@repo/types';
import { FilesService } from '../files/files.service';
import {
    AdminMerchantJoinRequestsRepository,
    type AdminMerchantJoinRequestListFilters,
    type MerchantJoinRequestRecord,
} from './admin-merchant-join-requests.repository';

@Injectable()
export class AdminMerchantJoinRequestsService {
    constructor(
        private readonly repository: AdminMerchantJoinRequestsRepository,
        private readonly filesService: FilesService,
    ) {}

    async listMerchantJoinRequests(
        query: AdminMerchantJoinRequestListQuery,
    ): Promise<AdminMerchantJoinRequestListResponse> {
        const normalized = this.normalizeQuery(query);
        const result = await this.repository.findAll(normalized.filters);
        const items = await Promise.all(
            result.items.map((item) => this.mapRecord(item)),
        );
        const totalPages = Math.ceil(result.total / normalized.limit) || 0;

        return {
            items,
            meta: {
                page: normalized.page,
                limit: normalized.limit,
                total: result.total,
                totalPages,
                hasNext: normalized.page < totalPages,
                hasPrev: normalized.page > 1,
            },
        };
    }

    async updateMerchantJoinRequest(
        id: string,
        input: AdminUpdateMerchantJoinRequest,
    ): Promise<AdminMerchantJoinRequest> {
        const existing = await this.repository.findById(id);

        if (!existing) {
            throw new NotFoundException('商户加盟申请不存在');
        }

        const updated = await this.repository.update(id, {
            isContacted: input.isContacted,
            adminRemark: this.normalizeNullableText(input.adminRemark),
            contactedAt: this.resolveContactedAt(existing, input.isContacted),
        });

        if (!updated) {
            throw new NotFoundException('商户加盟申请不存在');
        }

        return await this.mapRecord(updated);
    }

    async exportMerchantJoinRequestsCsv(): Promise<string> {
        const rows = await this.repository.findAllForExport();

        const header = [
            '申请时间',
            '姓名',
            '性别',
            '手机号',
            '年龄',
            '意向合作城市',
            '照片文件ID',
            '照片访问地址',
            '是否已联系',
            '联系时间',
            '管理员备注',
        ];

        const lines = rows.map((item) =>
            [
                item.createdAt.toISOString(),
                item.merchantName,
                item.gender === 'male' ? '男' : '女',
                item.phone,
                item.age,
                item.intentCity,
                item.photoFileId ?? '',
                item.photoFileId
                    ? this.buildStableFileAccessPath(item.photoFileId)
                    : '',
                item.isContacted ? '已联系' : '未联系',
                item.contactedAt?.toISOString() ?? '',
                item.adminRemark ?? '',
            ]
                .map((value) => this.escapeCsvCell(value))
                .join(','),
        );

        return `\uFEFF${[header.join(','), ...lines].join('\n')}`;
    }

    private normalizeQuery(
        query: AdminMerchantJoinRequestListQuery | undefined,
    ) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));

        const filters: AdminMerchantJoinRequestListFilters = {
            page,
            limit,
            keyword: query?.keyword?.trim() || undefined,
            contactStatus: query?.contactStatus ?? 'all',
        };

        return { page, limit, filters };
    }

    private resolveContactedAt(
        existing: MerchantJoinRequestRecord,
        isContacted: boolean,
    ): Date | null {
        if (!existing.isContacted && isContacted) {
            return new Date();
        }

        if (existing.isContacted && !isContacted) {
            return null;
        }

        return existing.contactedAt ?? null;
    }

    private normalizeNullableText(
        value: string | null | undefined,
    ): string | null {
        if (value === undefined || value === null) {
            return null;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private async mapRecord(
        record: MerchantJoinRequestRecord,
    ): Promise<AdminMerchantJoinRequest> {
        return {
            id: record.id,
            merchantName: record.merchantName,
            gender: record.gender as 'male' | 'female',
            phone: record.phone,
            age: record.age,
            intentCity: record.intentCity,
            photoFileId: record.photoFileId ?? null,
            photoFileUrl: await this.resolvePhotoFileUrl(record.photoFileId),
            isContacted: record.isContacted,
            adminRemark: record.adminRemark ?? null,
            contactedAt: record.contactedAt?.toISOString() ?? null,
            createdAt: record.createdAt.toISOString(),
            updatedAt: (record.updatedAt ?? record.createdAt).toISOString(),
        };
    }

    private async resolvePhotoFileUrl(fileId?: string | null) {
        if (!fileId) {
            return null;
        }

        try {
            const info = await this.filesService.getFileAccessInfo(fileId);
            return info.fileUrl;
        } catch {
            return null;
        }
    }

    private escapeCsvCell(value: string | number | boolean | null | undefined) {
        const stringValue = String(value ?? '');
        const neutralized = /^[=+\-@]/.test(stringValue)
            ? `'${stringValue}`
            : stringValue;
        const escaped = neutralized.replaceAll('"', '""');
        return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
    }

    private buildStableFileAccessPath(fileId: string) {
        return `/api/files/${fileId}`;
    }
}
