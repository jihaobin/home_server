import { setTimeout as sleep } from 'node:timers/promises';
import {
    Inject,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

import {
    CACHE_SERVICE,
    type IAdvancedCacheService,
    NotificationRedisKeys,
} from 'src/common/cache';

import type { NotificationEventPayload } from '@repo/types';
import { NotificationDispatcher } from '../notification.dispatcher';

interface StreamEntry {
    id: string;
    fields: string[];
}

@Injectable()
export class NotificationRelayService
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(NotificationRelayService.name);
    private readonly consumerId = process.pid + '-' + randomUUID();
    private running = false;
    private readonly streamClient: Redis;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
        private readonly notificationDispatcher: NotificationDispatcher,
    ) {
        const baseClient = this.cacheService.getClient<Redis>();
        this.streamClient = baseClient.duplicate();
    }

    async onModuleInit() {
        await this.ensureGroup();
        this.running = true;
        void this.loop();
    }

    onModuleDestroy() {
        this.running = false;
        void this.streamClient.quit().catch(() => undefined);
    }

    private async ensureGroup() {
        const client = this.cacheService.getClient<{
            xgroup: (...args: unknown[]) => Promise<unknown>;
        }>();
        try {
            await client.xgroup(
                'CREATE',
                NotificationRedisKeys.stream,
                NotificationRedisKeys.consumerGroup,
                '$',
                'MKSTREAM',
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (!message.includes('BUSYGROUP')) {
                this.logger.error('创建通知消费者组失败', message);
                throw error;
            }
        }
    }

    private async readBatch(): Promise<StreamEntry[]> {
        const client = this.streamClient as unknown as {
            xreadgroup: (
                ...args: Array<string | number>
            ) => Promise<Array<[string, Array<[string, string[]]>]> | null>;
        };

        const result = await client.xreadgroup(
            'GROUP',
            NotificationRedisKeys.consumerGroup,
            this.consumerId,
            'BLOCK',
            5000,
            'COUNT',
            50,
            'STREAMS',
            NotificationRedisKeys.stream,
            '>',
        );
        if (!result || !result.length) {
            return [];
        }
        const [, entries] = result[0];
        return (entries ?? []).map(([id, fields]) => ({ id, fields }));
    }

    private async ack(entry: StreamEntry) {
        await this.cacheService.xAck(
            NotificationRedisKeys.stream,
            NotificationRedisKeys.consumerGroup,
            entry.id,
        );
    }

    private toPayload(entry: StreamEntry): NotificationEventPayload | null {
        const record: Record<string, string> = {};
        for (let i = 0; i < entry.fields.length; i += 2) {
            record[entry.fields[i]] = entry.fields[i + 1] ?? '';
        }
        if (!record.event) {
            return null;
        }
        return record as NotificationEventPayload;
    }

    private async handleEntry(entry: StreamEntry) {
        try {
            const payload = this.toPayload(entry);
            if (!payload) {
                await this.ack(entry);
                return;
            }
            await this.notificationDispatcher.dispatch(payload);
            await this.ack(entry);
        } catch (error) {
            this.logger.warn(
                '派发通知失败',
                error instanceof Error ? error.message : String(error),
            );
            await sleep(500);
        }
    }

    private async loop() {
        while (this.running) {
            try {
                const entries = await this.readBatch();
                if (!entries.length) {
                    await sleep(500);
                    continue;
                }
                for (const entry of entries) {
                    await this.handleEntry(entry);
                }
            } catch (error) {
                this.logger.warn(
                    '通知流轮询异常',
                    error instanceof Error ? error.message : String(error),
                );
                await sleep(1000);
            }
        }
    }
}
