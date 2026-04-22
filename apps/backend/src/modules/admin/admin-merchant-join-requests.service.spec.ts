jest.mock('../files/files.service', () => ({
    FilesService: class FilesService {},
}));

import type { FilesService } from '../files/files.service';
import type {
    AdminMerchantJoinRequestsRepository,
    MerchantJoinRequestRecord,
} from './admin-merchant-join-requests.repository';
import { AdminMerchantJoinRequestsService } from './admin-merchant-join-requests.service';

type MockRepository = jest.Mocked<
    Pick<
        AdminMerchantJoinRequestsRepository,
        'findAll' | 'findById' | 'update' | 'findAllForExport'
    >
>;

type MockFilesService = jest.Mocked<Pick<FilesService, 'getFileAccessInfo'>>;

function createRecord(
    overrides: Partial<MerchantJoinRequestRecord> = {},
): MerchantJoinRequestRecord {
    return {
        id: 'join_1',
        merchantName: '王小美',
        gender: 'female',
        phone: '13800138000',
        age: 29,
        intentCity: '武汉',
        photoFileId: 'file_1',
        isContacted: false,
        adminRemark: null,
        contactedAt: null,
        createdAt: new Date('2026-04-21T08:00:00.000Z'),
        updatedAt: new Date('2026-04-21T08:00:00.000Z'),
        ...overrides,
    };
}

describe('AdminMerchantJoinRequestsService', () => {
    let service: AdminMerchantJoinRequestsService;
    let repository: MockRepository;
    let filesService: MockFilesService;

    beforeEach(() => {
        repository = {
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findAllForExport: jest.fn(),
        };
        filesService = {
            getFileAccessInfo: jest.fn(),
        };

        service = new AdminMerchantJoinRequestsService(
            repository as unknown as AdminMerchantJoinRequestsRepository,
            filesService as unknown as FilesService,
        );
    });

    it('首次标记已联系时写入 contactedAt', async () => {
        repository.findById.mockResolvedValue(createRecord({ isContacted: false }));
        repository.update.mockImplementation(async (_id, input) =>
            createRecord({
                isContacted: input.isContacted ?? false,
                adminRemark: input.adminRemark ?? null,
                contactedAt: input.contactedAt ?? null,
                updatedAt: new Date('2026-04-21T09:00:00.000Z'),
            }),
        );
        filesService.getFileAccessInfo.mockResolvedValue({
            fileUrl: 'https://example.com/file-1.jpg',
            fileName: 'file-1.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            expiresIn: 600,
        });

        const result = await service.updateMerchantJoinRequest('join_1', {
            isContacted: true,
            adminRemark: '  已电话联系  ',
        });

        expect(repository.update).toHaveBeenCalledWith(
            'join_1',
            expect.objectContaining({
                isContacted: true,
                adminRemark: '已电话联系',
                contactedAt: expect.any(Date),
            }),
        );
        expect(result.isContacted).toBe(true);
        expect(result.contactedAt).toBeTruthy();
    });

    it('从已联系改回未联系时清空 contactedAt', async () => {
        repository.findById.mockResolvedValue(
            createRecord({
                isContacted: true,
                contactedAt: new Date('2026-04-21T08:30:00.000Z'),
            }),
        );
        repository.update.mockImplementation(async (_id, input) =>
            createRecord({
                isContacted: input.isContacted ?? true,
                adminRemark: input.adminRemark ?? null,
                contactedAt: input.contactedAt ?? null,
                updatedAt: new Date('2026-04-21T09:00:00.000Z'),
            }),
        );
        filesService.getFileAccessInfo.mockResolvedValue({
            fileUrl: 'https://example.com/file-1.jpg',
            fileName: 'file-1.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            expiresIn: 600,
        });

        const result = await service.updateMerchantJoinRequest('join_1', {
            isContacted: false,
            adminRemark: ' ',
        });

        expect(repository.update).toHaveBeenCalledWith(
            'join_1',
            expect.objectContaining({
                isContacted: false,
                adminRemark: null,
                contactedAt: null,
            }),
        );
        expect(result.isContacted).toBe(false);
        expect(result.contactedAt).toBeNull();
    });

    it('导出时包含 BOM 和中文表头', async () => {
        repository.findAllForExport.mockResolvedValue([
            createRecord({
                photoFileId: 'file_1',
                merchantName: '=cmd',
                adminRemark: '@危险备注',
            }),
        ]);

        const csv = await service.exportMerchantJoinRequestsCsv();

        expect(csv.startsWith('\uFEFF')).toBe(true);
        expect(csv).toContain(
            '申请时间,姓名,性别,手机号,年龄,意向合作城市,照片文件ID,照片访问地址,是否已联系,联系时间,管理员备注',
        );
        expect(csv).toContain("'=cmd");
        expect(csv).toContain("'@危险备注");
        expect(csv).toContain('/files/file_1');
    });

    it('列表项会解析 photoFileUrl', async () => {
        repository.findAll.mockResolvedValue({
            items: [createRecord({ photoFileId: 'file_1' })],
            total: 1,
            page: 1,
            limit: 20,
        });
        filesService.getFileAccessInfo.mockResolvedValue({
            fileUrl: 'https://example.com/file-1.jpg',
            fileName: 'file-1.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            expiresIn: 600,
        });

        const result = await service.listMerchantJoinRequests({
            page: 1,
            limit: 20,
            contactStatus: 'all',
        });

        expect(result.items[0]).toEqual(
            expect.objectContaining({
                photoFileId: 'file_1',
                photoFileUrl: 'https://example.com/file-1.jpg',
            }),
        );
    });
});
