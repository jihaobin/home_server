import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NotificationEventPayload } from '@repo/types';

import { CACHE_SERVICE, type IAdvancedCacheService } from 'src/common/cache';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { users } from 'src/common/database/schema/auth-user';
import { VoiceCallService } from 'src/common/voice';

import {
    NotificationRepository,
    type NotificationTargetRecord,
} from './notification.repository';

const NEW_ORDER_VOICE_EVENT = 'order_pending_acceptance_assigned';
const VOICE_DEDUPLICATION_TTL_SECONDS = 7 * 24 * 60 * 60;
const VOICE_INFLIGHT_TTL_SECONDS = 5 * 60;

@Injectable()
export class NotificationVoiceCallService {
    private readonly logger = new Logger(NotificationVoiceCallService.name);

    constructor(
        private readonly voiceCallService: VoiceCallService,
        private readonly notificationRepository: NotificationRepository,
        @Inject(DB)
        private readonly db: DbType,
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {}

    async triggerNewOrderVoice(params: {
        notificationId: string;
        payload: NotificationEventPayload;
        target: NotificationTargetRecord;
    }): Promise<void> {
        if (!this.shouldTriggerNewOrderVoice(params.payload.event)) {
            return;
        }
        if (!this.getVoiceTemplateCode()) {
            return;
        }

        const payload: NotificationEventPayload = {
            ...params.payload,
            notificationId:
                params.payload.notificationId ?? params.notificationId,
        };
        await this.triggerVoiceCallForTarget(payload, params.target);
    }

    private async triggerVoiceCallForTarget(
        payload: NotificationEventPayload,
        target: NotificationTargetRecord,
    ) {
        if (target.targetType !== 'service_personnel') {
            this.logger.warn(
                `语音提醒跳过：目标类型不是服务人员 targetType=${target.targetType} target=${target.targetId} notification=${payload.notificationId}`,
            );
            return;
        }

        const phoneNumber = await this.resolvePhoneNumber(payload, target);
        if (!phoneNumber) {
            this.logger.warn(
                `语音提醒跳过：未找到服务人员手机号 target=${target.targetId} notification=${payload.notificationId}`,
            );
            return;
        }

        const dedupeKey = this.getDedupeKey(payload.notificationId!, target.id);
        const inflightKey = this.getInflightKey(
            payload.notificationId!,
            target.id,
        );
        const lockKey = `${dedupeKey}:lock`;
        const lockId = await this.cacheService.acquireLock(lockKey, 15, 0, 0);
        if (!lockId) {
            this.logger.warn(
                `语音提醒锁获取失败 notification=${payload.notificationId} target=${target.targetId}`,
            );
            return;
        }

        try {
            if (
                (await this.cacheService.get<string>(dedupeKey)) ||
                (await this.cacheService.get<string>(inflightKey))
            ) {
                return;
            }
            await this.cacheService.set(
                inflightKey,
                'processing',
                VOICE_INFLIGHT_TTL_SECONDS,
            );

            const outId = this.buildOutId(payload, target);
            const baseContext = {
                event: payload.event ?? null,
                orderId: payload.orderId ?? null,
                templateCode: this.getVoiceTemplateCode(),
                calledShowNumber: this.getCalledShowNumber(),
                calledNumber: phoneNumber,
                requestedAt: new Date().toISOString(),
            };
            await this.notificationRepository.createVoiceDeliveryLog({
                notificationId: payload.notificationId!,
                targetRecordId: target.id,
                outId,
                status: 'pending',
                context: {
                    request: baseContext,
                },
            });

            const result = await this.voiceCallService.singleCallByTts({
                calledNumber: phoneNumber,
                ttsCode: this.getVoiceTemplateCode(),
                calledShowNumber: this.getCalledShowNumber(),
                outId,
            });

            if (!result.success) {
                const failedDelivery =
                    await this.notificationRepository.getVoiceDeliveryWithDetails(
                        {
                            outId,
                        },
                    );
                if (failedDelivery) {
                    await this.notificationRepository.updateVoiceDeliveryLog(
                        failedDelivery.id,
                        {
                            status: 'failed',
                            lastError:
                                result.error ??
                                result.message ??
                                '语音通话发起失败',
                            providerStatusCode: result.code ?? null,
                            providerStatusMessage:
                                result.message ?? result.error ?? null,
                            context: {
                                ...this.cloneContext(failedDelivery.context),
                                request: baseContext,
                                response: {
                                    success: false,
                                    code: result.code ?? null,
                                    message: result.message ?? null,
                                    error: result.error ?? null,
                                    recommend: result.recommend ?? null,
                                    requestId: result.requestId ?? null,
                                    callId: result.callId ?? null,
                                    outId,
                                },
                            },
                        },
                    );
                }
                this.logger.warn(
                    `新订单语音提醒失败 notification=${payload.notificationId} target=${target.targetId} error=${result.error ?? result.message ?? 'unknown'}`,
                );
                return;
            }

            const sentDelivery =
                await this.notificationRepository.getVoiceDeliveryWithDetails({
                    outId,
                });
            if (sentDelivery) {
                await this.notificationRepository.updateVoiceDeliveryLog(
                    sentDelivery.id,
                    {
                        callId: result.callId ?? null,
                        status: 'sent',
                        providerStatusCode: result.code ?? null,
                        providerStatusMessage: result.message ?? null,
                        lastError: null,
                        context: {
                            ...this.cloneContext(sentDelivery.context),
                            request: baseContext,
                            response: {
                                success: true,
                                code: result.code ?? null,
                                message: result.message ?? null,
                                requestId: result.requestId ?? null,
                                callId: result.callId ?? null,
                                outId,
                            },
                        },
                    },
                );
            }

            await this.cacheService.set(
                dedupeKey,
                result.callId ?? 'sent',
                VOICE_DEDUPLICATION_TTL_SECONDS,
            );
            await this.cacheService.del(inflightKey);
            this.logger.log(
                `新订单语音提醒已发起 notification=${payload.notificationId} target=${target.targetId} outId=${result.outId ?? 'none'} callId=${result.callId ?? 'none'}`,
            );
        } finally {
            await this.cacheService.del(inflightKey).catch(() => undefined);
            await this.cacheService
                .releaseLock(lockKey, lockId)
                .catch(() => undefined);
        }
    }

    private async resolvePhoneNumber(
        payload: NotificationEventPayload,
        target: NotificationTargetRecord,
    ): Promise<string | null> {
        const candidate =
            this.normalizePhone(
                this.readRecordString(target.metadata, 'phone') ??
                    this.readRecordString(target.metadata, 'mobile'),
            ) ??
            this.normalizePhone(
                payload.phone ?? payload.phoneNumber ?? payload.mobile,
            );
        if (candidate) {
            return candidate;
        }

        const userId = target.userId ?? payload.userId;
        if (!userId) {
            return null;
        }

        const user = await this.db.query.users.findFirst({
            columns: { phoneNumber: true },
            where: eq(users.id, userId),
        });
        return this.normalizePhone(user?.phoneNumber);
    }

    private shouldTriggerNewOrderVoice(event?: string): boolean {
        return event === NEW_ORDER_VOICE_EVENT;
    }

    private getVoiceTemplateCode(): string {
        return process.env.ALIYUN_DYVMS_TEMPLATE_NEW_ORDER || 'TTS_328535234';
    }

    private getCalledShowNumber(): string {
        return process.env.ALIYUN_DYVMS_CALLED_SHOW_NUMBER || '02131934558';
    }

    private getDedupeKey(
        notificationId: string,
        targetRecordId: string,
    ): string {
        return `notification:voice:new-order:${notificationId}:${targetRecordId}`;
    }

    private getInflightKey(
        notificationId: string,
        targetRecordId: string,
    ): string {
        return `${this.getDedupeKey(notificationId, targetRecordId)}:inflight`;
    }

    private buildOutId(
        payload: NotificationEventPayload,
        target: NotificationTargetRecord,
    ): string {
        const segments = [
            'voice',
            payload.notificationId ?? 'notification',
            payload.orderId ?? 'order',
            target.id,
        ];
        return segments.join(':');
    }

    private normalizePhone(value?: string | null): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        const digits = value.replace(/[\s-]/g, '');
        if (!digits.length) {
            return null;
        }
        if (digits.startsWith('+86')) {
            return digits.slice(3);
        }
        if (digits.startsWith('86')) {
            return digits.slice(2);
        }
        return digits;
    }

    private readRecordString(record: unknown, key: string): string | undefined {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            return undefined;
        }
        const value = (record as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : undefined;
    }

    private cloneContext(
        context: Record<string, unknown> | null | undefined,
    ): Record<string, unknown> {
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            return {};
        }
        return { ...context };
    }
}
