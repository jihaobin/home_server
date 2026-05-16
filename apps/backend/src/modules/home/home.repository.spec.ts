jest.mock('../files/files.service', () => ({
    FilesService: class FilesService {},
}));

jest.mock('../service-personnel/service-personnel.repository', () => ({
    buildActiveOfferingCondition: jest.fn(() => true),
}));

import { buildActiveOfferingCondition } from '../service-personnel/service-personnel.repository';
import { HomeRepository } from './home.repository';

type QueryRecorder = {
    innerJoins: unknown[];
    finalRows: unknown[];
};

function createSelectChain(recorder: QueryRecorder) {
    const chain = {
        select: jest.fn(() => chain),
        from: jest.fn(() => chain),
        innerJoin: jest.fn((table: unknown) => {
            recorder.innerJoins.push(table);
            return chain;
        }),
        leftJoin: jest.fn(() => chain),
        where: jest.fn(() => chain),
        orderBy: jest.fn(() => chain),
        offset: jest.fn(() => chain),
        limit: jest.fn(() => Promise.resolve(recorder.finalRows)),
    };

    return chain;
}

function createDbMock(recorder: QueryRecorder) {
    return {
        select: jest.fn(() => createSelectChain(recorder)),
        $with: jest.fn(() => ({
            as: jest.fn((query: unknown) => query),
        })),
        with: jest.fn(() => createSelectChain(recorder)),
    };
}

function createRepository(recorder: QueryRecorder) {
    const db = createDbMock(recorder);
    const filesService = { getFileAccessInfo: jest.fn() };
    const geoLocationService = {
        createUserPoint: jest.fn(() => 'POINT(0 0)'),
        createOptimizedDistanceCondition: jest.fn(() => ({
            fastFilter: true,
            exactDistance: { as: jest.fn(() => 0) },
            exactFilter: true,
        })),
    };

    const repository = new HomeRepository(
        db as never,
        filesService as never,
        geoLocationService as never,
    );

    Object.defineProperty(repository, 'getFullyActiveCategoryIds', {
        value: jest.fn().mockResolvedValue(['cat_1']),
    });

    return repository;
}

describe('HomeRepository recommendation publication filters', () => {
    it('首页有定位推荐只返回 active+approved 发布服务', async () => {
        jest.mocked(buildActiveOfferingCondition).mockClear();
        const recorder: QueryRecorder = {
            innerJoins: [],
            finalRows: [],
        };
        const repository = createRepository(recorder);

        await repository.getRecommendedPersonnelWithCenter({
            center: [113, 23],
            maxDistanceKm: 20,
            limit: 10,
        });

        expect(buildActiveOfferingCondition).toHaveBeenCalledTimes(1);
    });

    it('首页无定位推荐只返回 active+approved 发布服务', async () => {
        jest.mocked(buildActiveOfferingCondition).mockClear();
        const recorder: QueryRecorder = {
            innerJoins: [],
            finalRows: [],
        };
        const repository = createRepository(recorder);

        await repository.getRecommendedPersonnelGlobal({ limit: 10 });

        expect(buildActiveOfferingCondition).toHaveBeenCalledTimes(1);
    });
});
