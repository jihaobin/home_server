import { AdminServiceTagsRepository } from './admin-service-tags.repository';
import { AdminServiceTagsService } from './admin-service-tags.service';

type MockRepository = jest.Mocked<
    Pick<
        AdminServiceTagsRepository,
        | 'findAll'
        | 'findById'
        | 'findByDomainAndSlug'
        | 'countReferencedServices'
        | 'create'
        | 'update'
        | 'delete'
    >
>;

describe('AdminServiceTagsService', () => {
    let service: AdminServiceTagsService;
    let repository: MockRepository;

    beforeEach(() => {
        repository = {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByDomainAndSlug: jest.fn(),
            countReferencedServices: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };

        service = new AdminServiceTagsService(
            repository as unknown as AdminServiceTagsRepository,
        );
    });

    it('同域 slug 冲突时拒绝创建', async () => {
        repository.findByDomainAndSlug.mockResolvedValue({
            id: 'tag_existing',
            name: '已有标签',
            slug: 'relax',
            domain: 'massage',
            sortOrder: 10,
            isActive: true,
            description: null,
        } as any);

        await expect(
            service.createTag({
                name: '放松',
                slug: 'relax',
                domain: 'massage',
                sortOrder: 10,
                isActive: true,
                description: null,
            }),
        ).rejects.toThrow('该 slug 已在当前业务域中使用');

        expect(repository.create).not.toHaveBeenCalled();
    });

    it('已被服务引用时拒绝删除', async () => {
        repository.findById.mockResolvedValue({
            id: 'tag_used',
            name: '经络调理',
            slug: 'meridian',
            domain: 'massage',
            sortOrder: 1,
            isActive: true,
            description: null,
        } as any);
        repository.countReferencedServices.mockResolvedValue(2);

        await expect(service.deleteTag('tag_used')).rejects.toThrow(
            '该标签已被服务引用，无法删除；如需下线请先停用',
        );

        expect(repository.delete).not.toHaveBeenCalled();
    });
});
