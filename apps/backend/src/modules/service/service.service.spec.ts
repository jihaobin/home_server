import type { FilesService } from '../files/files.service';
import type { ServiceRepository } from './service.repository';
import { ServiceService } from './service.service';

jest.mock('sharp', () => jest.fn());

type MockServiceRepository = jest.Mocked<
    Pick<
        ServiceRepository,
        | 'createService'
        | 'updateService'
        | 'getServiceById'
        | 'findServiceTagById'
    >
>;

type MockFilesService = jest.Mocked<Pick<FilesService, 'getFileAccessInfo'>>;

describe('ServiceService', () => {
    let service: ServiceService;
    let serviceRepository: MockServiceRepository;
    let filesService: MockFilesService;

    beforeEach(() => {
        serviceRepository = {
            createService: jest.fn(),
            updateService: jest.fn(),
            getServiceById: jest.fn(),
            findServiceTagById: jest.fn(),
        };
        filesService = {
            getFileAccessInfo: jest.fn(),
        };

        service = new ServiceService();
        (service as any).serviceRepository =
            serviceRepository as unknown as ServiceRepository;
        (service as any).filesService =
            filesService as unknown as FilesService;
    });

    describe('updateService', () => {
        it('禁止把服务改绑到停用标签', async () => {
            serviceRepository.getServiceById.mockResolvedValue({
                id: 'srv_1',
                serviceTagId: 'tag_old',
                imageFileId: null,
                category: null,
            } as any);
            serviceRepository.findServiceTagById.mockResolvedValue({
                id: 'tag_inactive',
                isActive: false,
                domain: 'massage',
            } as any);

            await expect(
                service.updateService('srv_1', {
                    serviceTagId: 'tag_inactive',
                }),
            ).rejects.toThrow('停用标签不能作为新的绑定目标');

            expect(serviceRepository.updateService).not.toHaveBeenCalled();
        });

        it('允许保留历史停用标签并修改其他字段', async () => {
            serviceRepository.getServiceById
                .mockResolvedValueOnce({
                    id: 'srv_1',
                    serviceTagId: 'tag_inactive',
                    imageFileId: null,
                    category: null,
                } as any)
                .mockResolvedValueOnce({
                    id: 'srv_1',
                    name: '肩颈调理',
                    serviceTagId: 'tag_inactive',
                    imageFileId: null,
                    category: null,
                } as any);
            serviceRepository.findServiceTagById.mockResolvedValue({
                id: 'tag_inactive',
                isActive: false,
                domain: 'massage',
            } as any);
            serviceRepository.updateService.mockResolvedValue({
                id: 'srv_1',
            } as any);

            await expect(
                service.updateService('srv_1', {
                    name: '肩颈调理',
                    serviceTagId: 'tag_inactive',
                }),
            ).resolves.toMatchObject({
                id: 'srv_1',
                serviceTagId: 'tag_inactive',
            });

            expect(serviceRepository.updateService).toHaveBeenCalledWith(
                'srv_1',
                {
                    name: '肩颈调理',
                    serviceTagId: 'tag_inactive',
                },
            );
        });

        it('允许解绑标签', async () => {
            serviceRepository.getServiceById
                .mockResolvedValueOnce({
                    id: 'srv_1',
                    serviceTagId: 'tag_inactive',
                    imageFileId: null,
                    category: null,
                } as any)
                .mockResolvedValueOnce({
                    id: 'srv_1',
                    serviceTagId: null,
                    imageFileId: null,
                    category: null,
                } as any);
            serviceRepository.updateService.mockResolvedValue({
                id: 'srv_1',
            } as any);

            await expect(
                service.updateService('srv_1', {
                    serviceTagId: null,
                }),
            ).resolves.toMatchObject({
                id: 'srv_1',
                serviceTagId: null,
            });

            expect(serviceRepository.findServiceTagById).not.toHaveBeenCalled();
        });
    });

    describe('createService', () => {
        it('创建时绑定停用标签失败', async () => {
            serviceRepository.findServiceTagById.mockResolvedValue({
                id: 'tag_inactive',
                isActive: false,
                domain: 'massage',
            } as any);

            await expect(
                service.createService({
                    categoryId: 'cat_1',
                    name: '全身推拿',
                    description: null,
                    imageFileId: null,
                    serviceTagId: 'tag_inactive',
                    isActive: true,
                }),
            ).rejects.toThrow('停用标签不能作为新的绑定目标');

            expect(serviceRepository.createService).not.toHaveBeenCalled();
        });
    });
});
