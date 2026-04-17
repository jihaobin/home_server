import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type {
    AdminServiceTag,
    AdminServiceTagListQuery,
    AdminServiceTagListResponse,
    CreateAdminServiceTagInput,
    ServiceTagDomain,
    UpdateAdminServiceTagInput,
} from '@repo/types';
import { serviceTags } from 'src/common/database/schema';
import {
    AdminServiceTagRecord,
    AdminServiceTagsRepository,
} from './admin-service-tags.repository';

@Injectable()
export class AdminServiceTagsService {
    constructor(private readonly repository: AdminServiceTagsRepository) {}

    async listTags(
        query: AdminServiceTagListQuery,
    ): Promise<AdminServiceTagListResponse> {
        return {
            items: await this.repository.findAll(query),
        };
    }

    async createTag(
        payload: CreateAdminServiceTagInput,
    ): Promise<AdminServiceTag> {
        const slug = payload.slug.trim();

        const duplicated = await this.repository.findByDomainAndSlug(
            payload.domain,
            slug,
        );

        if (duplicated) {
            throw new BadRequestException('该 slug 已在当前业务域中使用');
        }

        const created = await this.repository.create({
            name: payload.name.trim(),
            slug,
            domain: payload.domain,
            sortOrder: payload.sortOrder,
            isActive: payload.isActive,
            description: normalizeNullableText(payload.description),
        });

        return await this.toAdminServiceTag(created);
    }

    async updateTag(
        id: string,
        payload: UpdateAdminServiceTagInput,
    ): Promise<AdminServiceTag> {
        const existing = await this.repository.findById(id);

        if (!existing) {
            throw new NotFoundException('服务标签不存在');
        }

        const nextSlug = payload.slug?.trim();

        if (nextSlug && nextSlug !== existing.slug) {
            const duplicated = await this.repository.findByDomainAndSlug(
                existing.domain as ServiceTagDomain,
                nextSlug,
            );

            if (duplicated && duplicated.id !== id) {
                throw new BadRequestException('该 slug 已在当前业务域中使用');
            }
        }

        const updatePayload: Partial<typeof serviceTags.$inferInsert> = {};

        if (payload.name !== undefined) {
            updatePayload.name = payload.name.trim();
        }

        if (nextSlug !== undefined) {
            updatePayload.slug = nextSlug;
        }

        if (payload.sortOrder !== undefined) {
            updatePayload.sortOrder = payload.sortOrder;
        }

        if (payload.isActive !== undefined) {
            updatePayload.isActive = payload.isActive;
        }

        if (payload.description !== undefined) {
            updatePayload.description = normalizeNullableText(
                payload.description,
            );
        }

        const updated = await this.repository.update(id, updatePayload);

        if (!updated) {
            throw new NotFoundException('服务标签不存在');
        }

        return await this.toAdminServiceTag(updated);
    }

    async deleteTag(id: string): Promise<{ success: boolean }> {
        const existing = await this.repository.findById(id);

        if (!existing) {
            throw new NotFoundException('服务标签不存在');
        }

        const serviceCount = await this.repository.countReferencedServices(id);

        if (serviceCount > 0) {
            throw new ConflictException(
                '该标签已被服务引用，无法删除；如需下线请先停用',
            );
        }

        const deleted = await this.repository.delete(id);

        if (!deleted) {
            throw new NotFoundException('服务标签不存在');
        }

        return { success: true };
    }

    private async toAdminServiceTag(
        record: AdminServiceTagRecord,
    ): Promise<AdminServiceTag> {
        return {
            id: record.id,
            name: record.name,
            slug: record.slug,
            domain: record.domain as ServiceTagDomain,
            sortOrder: record.sortOrder,
            isActive: record.isActive,
            description: record.description ?? null,
            serviceCount: await this.repository.countReferencedServices(
                record.id,
            ),
        };
    }
}

function normalizeNullableText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
}
