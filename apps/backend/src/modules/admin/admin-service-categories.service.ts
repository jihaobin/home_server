import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import type {
    AdminServiceCategory,
    AdminServiceCategoryListResponse,
    AdminServiceCategoryTree,
    CreateAdminServiceCategoryInput,
    UpdateAdminServiceCategoryInput,
} from '@repo/types';

import {
    AdminServiceCategoriesRepository,
    type AdminServiceCategoryRecord,
} from './admin-service-categories.repository';

import { FilesService } from '../files/files.service';

import { serviceCategories } from 'src/common/database/schema';

@Injectable()
export class AdminServiceCategoriesService {
    constructor(
        private readonly repository: AdminServiceCategoriesRepository,

        private readonly filesService: FilesService,
    ) {}

    async listCategories(): Promise<AdminServiceCategoryListResponse> {
        const records = await this.repository.findAll();

        const categories = await Promise.all(
            records.map((record) => this.toCategory(record)),
        );

        return {
            flat: categories,

            tree: buildAdminCategoryTree(categories),
        };
    }

    async getCategory(id: string): Promise<AdminServiceCategory> {
        const record = await this.repository.findById(id);

        if (!record) {
            throw new NotFoundException('服务分类不存在');
        }

        return this.toCategory(record);
    }

    async createCategory(
        payload: CreateAdminServiceCategoryInput,
    ): Promise<AdminServiceCategory> {
        // 暂时仅允许创建 dep=1 的一级分类（不允许创建子分类）。
        if (payload.parentId) {
            throw new BadRequestException('暂不支持创建子分类');
        }

        const parentId = null;
        const dep = 1;

        const sortOrder =
            payload.sortOrder ??
            (await this.repository.getNextSortOrder(parentId));

        const description =
            payload.description === undefined
                ? null
                : normalizeTextInput(payload.description);

        const iconFileId = await this.normalizeIconFileId(
            payload.iconFileId ?? null,
        );
        const commissionRate = payload.commissionRate ?? 30;

        return await this.toCategory(
            await this.repository.create({
                parentId,

                name: payload.name.trim(),

                description,

                dep,

                isActive: payload.isActive ?? true,

                sortOrder,

                commissionRate,

                iconFileId,
            }),
        );
    }

    async updateCategory(
        id: string,

        payload: UpdateAdminServiceCategoryInput,
    ): Promise<AdminServiceCategory> {
        const existing = await this.repository.findById(id);

        if (!existing) {
            throw new NotFoundException('服务分类不存在');
        }

        let nextParentId = existing.parentId;

        let nextDep = existing.dep;

        if (payload.parentId !== undefined) {
            if (payload.parentId === id) {
                throw new BadRequestException('父分类不能是自身');
            }

            // 暂时不允许设置父分类（不允许创建/移动到子分类）。
            if (payload.parentId) {
                throw new BadRequestException(
                    '暂不支持设置父分类（仅支持一级分类）',
                );
            }

            nextParentId = null;
            nextDep = 1;
        }

        const description =
            payload.description === undefined
                ? undefined
                : normalizeTextInput(payload.description);

        const iconFileId =
            payload.iconFileId !== undefined
                ? await this.normalizeIconFileId(payload.iconFileId)
                : undefined;

        const updatePayload: Partial<typeof serviceCategories.$inferInsert> = {
            parentId: nextParentId,

            dep: nextDep,
        };

        if (payload.name !== undefined) {
            updatePayload.name = payload.name.trim();
        }

        if (description !== undefined) {
            updatePayload.description = description;
        }

        if (payload.isActive !== undefined) {
            updatePayload.isActive = payload.isActive;
        }

        if (payload.sortOrder !== undefined) {
            updatePayload.sortOrder = payload.sortOrder;
        }

        if (payload.commissionRate !== undefined) {
            updatePayload.commissionRate = payload.commissionRate;
        }

        if (iconFileId !== undefined) {
            updatePayload.iconFileId = iconFileId;
        }

        const updated = await this.repository.update(id, updatePayload);

        if (!updated) {
            throw new Error('更新服务分类失败');
        }

        return this.toCategory(updated);
    }

    async deleteCategory(id: string): Promise<{ success: boolean }> {
        const existing = await this.repository.findById(id);

        if (!existing) {
            throw new NotFoundException('服务分类不存在');
        }

        const hasChildren = (await this.repository.countChildren(id)) > 0;

        if (hasChildren) {
            throw new BadRequestException('请先删除子分类');
        }

        const hasServices = (await this.repository.countServices(id)) > 0;

        if (hasServices) {
            throw new BadRequestException('请先处理分类下的服务');
        }

        await this.repository.delete(id);

        return { success: true };
    }

    private async normalizeIconFileId(
        iconFileId?: string | null,
    ): Promise<string | null> {
        if (!iconFileId) {
            return null;
        }

        const exists = await this.repository.hasIconFile(iconFileId);

        if (!exists) {
            throw new BadRequestException('图标文件不存在或已删除');
        }

        return iconFileId;
    }

    private async toCategory(
        record: AdminServiceCategoryRecord,
    ): Promise<AdminServiceCategory> {
        return {
            ...record,

            iconFileUrl: await this.getIconUrl(record.iconFileId),
        };
    }

    private async getIconUrl(
        fileId: string | null | undefined,
    ): Promise<string | null> {
        if (!fileId) {
            return null;
        }

        if (!(await this.repository.hasIconFile(fileId))) {
            return null;
        }

        try {
            const access = await this.filesService.getFileAccessInfo(fileId);

            return access.fileUrl;
        } catch {
            return null;
        }
    }
}

export function buildAdminCategoryTree(
    categories: AdminServiceCategory[],
): AdminServiceCategoryTree[] {
    const map = new Map<string, AdminServiceCategoryTree>();

    const roots: AdminServiceCategoryTree[] = [];

    categories.forEach((category) => {
        map.set(category.id, {
            ...category,

            children: [],
        });
    });

    categories.forEach((category) => {
        const node = map.get(category.id);

        if (!node) {
            return;
        }

        if (category.parentId) {
            const parent = map.get(category.parentId);

            if (parent) {
                parent.children.push(node);
            }
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes: AdminServiceCategoryTree[]) => {
        nodes.sort((a, b) => {
            if (a.sortOrder === b.sortOrder) {
                return a.name.localeCompare(b.name);
            }

            return a.sortOrder - b.sortOrder;
        });

        nodes.forEach((node) => sortNodes(node.children));
    };

    sortNodes(roots);

    return roots;
}

function normalizeTextInput(value: string | null): string | null {
    if (value === null) {
        return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
}
