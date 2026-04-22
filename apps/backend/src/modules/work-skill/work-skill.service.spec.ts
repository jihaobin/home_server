import { BadRequestException } from '@nestjs/common';
import type { WorkSkillRepository } from './work-skill.repository';
import { WorkSkillService } from './work-skill.service';

type MockWorkSkillRepository = jest.Mocked<
    Pick<WorkSkillRepository, 'findServicesByIds' | 'updateServiceOfferings'>
>;

describe('WorkSkillService.updateServiceOfferings', () => {
    let service: WorkSkillService;
    let repository: MockWorkSkillRepository;

    beforeEach(() => {
        repository = {
            findServicesByIds: jest.fn(),
            updateServiceOfferings: jest.fn(),
        };

        service = new WorkSkillService();
        Reflect.set(service, 'workSkillRepository', repository);
    });

    it('命中按摩分类且两类证书都为空时抛出 BadRequestException', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_massage_1',
                categoryId: 'cat_child_massage',
                categoryName: '上门按摩',
            },
        ]);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '199',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: null,
                vocationalQualificationFileId: null,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('命中按摩分类且商家资质存在时允许保存', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_massage_1',
                categoryId: 'cat_child_massage',
                categoryName: '精油按摩',
            },
        ]);
        repository.updateServiceOfferings.mockResolvedValue(undefined);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '199',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: 'file_merchant',
                vocationalQualificationFileId: null,
            }),
        ).resolves.toBeUndefined();
    });

    it('命中按摩分类且从业资格证书存在时允许保存', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_massage_1',
                categoryId: 'cat_child_massage',
                categoryName: '按摩子分类',
            },
        ]);
        repository.updateServiceOfferings.mockResolvedValue(undefined);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '199',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: null,
                vocationalQualificationFileId: 'file_vocational',
            }),
        ).resolves.toBeUndefined();
    });

    it('未命中按摩分类时不要求证书', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_clean_1',
                categoryId: 'cat_cleaning',
                categoryName: '家庭保洁',
            },
        ]);
        repository.updateServiceOfferings.mockResolvedValue(undefined);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_clean_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '99',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: null,
                vocationalQualificationFileId: null,
            }),
        ).resolves.toBeUndefined();
    });
});
