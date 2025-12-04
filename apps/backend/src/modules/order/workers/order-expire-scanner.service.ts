import { setTimeout as sleep } from 'node:timers/promises';
import type { Redis } from 'ioredis';
import {
    Inject,
    Injectable,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import {
    CACHE_SERVICE,
    type IAdvancedCacheService,
    OrderExpireRedisKeys,
} from 'src/common/cache';

interface DelayTask {
    orderId: string;
    score: number;
}

@Injectable()
export class OrderExpireScannerService
    implements OnModuleInit, OnModuleDestroy
{
    private running = false;
    private lockId: string | null = null;
    private readonly blockingClient: Redis;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {
        const baseClient = this.cacheService.getClient<Redis>();
        this.blockingClient = baseClient.duplicate();
    }

    onModuleInit() {
        this.running = true;
        void this.loop();
    }

    async onModuleDestroy() {
        this.running = false;
        void this.blockingClient.quit().catch(() => undefined);
        if (this.lockId) {
            await this.cacheService
                .releaseLock(OrderExpireRedisKeys.scannerLock, this.lockId)
                .catch(() => undefined);
            this.lockId = null;
        }
    }

    private async acquireLock() {
        if (this.lockId) {
            return true;
        }
        this.lockId = await this.cacheService.acquireLock(
            OrderExpireRedisKeys.scannerLock,
            10,
            0,
            200,
        );
        return Boolean(this.lockId);
    }

    private async releaseLock() {
        if (!this.lockId) {
            return;
        }
        await this.cacheService
            .releaseLock(OrderExpireRedisKeys.scannerLock, this.lockId)
            .catch(() => undefined);
        this.lockId = null;
    }

    private async readNext(): Promise<DelayTask | null> {
        const popped = await this.blockingClient.bzpopmin(
            OrderExpireRedisKeys.delayZset,
            1,
        );
        if (!popped) {
            return null;
        }
        const [, rawMember, scoreString] = popped;
        let orderId: string;
        try {
            const parsed = JSON.parse(rawMember) as
                | { orderId?: string }
                | string
                | null;
            if (typeof parsed === 'string' && parsed.length > 0) {
                orderId = parsed;
            } else if (
                parsed &&
                typeof parsed === 'object' &&
                typeof parsed.orderId === 'string'
            ) {
                orderId = parsed.orderId;
            } else {
                orderId = rawMember;
            }
        } catch {
            orderId = rawMember;
        }
        return {
            orderId,
            score: Number(scoreString),
        };
    }

    private async handleTask(task: DelayTask) {
        const now = Date.now();
        if (task.score > now) {
            await this.cacheService.zAdd(
                OrderExpireRedisKeys.delayZset,
                task.score,
                task.orderId,
            );
            await sleep(task.score - now);
            return;
        }

        await this.cacheService.xAdd(OrderExpireRedisKeys.expiredStream, '*', {
            orderId: task.orderId,
            expiresAt: new Date(task.score).toISOString(),
            attempt: 1,
        });
    }

    private async loop() {
        while (this.running) {
            try {
                if (!(await this.acquireLock())) {
                    await sleep(1000);
                    continue;
                }

                const task = await this.readNext();
                if (!task) {
                    await sleep(200);
                    continue;
                }

                await this.handleTask(task);
            } catch {
                await sleep(500);
            }
        }
        await this.releaseLock();
    }
}
