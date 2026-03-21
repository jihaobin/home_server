import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
    NotificationChannelResult,
    NotificationDeliveryStatus,
} from '@repo/types';
import type { Request } from 'express';

import type { NotificationMetadata } from 'src/common/database/schema/notifications';

import { NotificationDispatcher } from './notification.dispatcher';
import {
    NotificationRepository,
    type VoiceDeliveryWithRelations,
} from './notification.repository';
import {
    AliyunVoiceCallbackPayloadSchema,
    type AliyunVoiceReportDto,
} from './dto/aliyun-voice-callback.dto';

interface SmsFallbackResult {
    success: boolean;
    results?: NotificationChannelResult[];
    error?: string;
}

@Injectable()
export class AliyunVoiceCallbackService {
    private readonly logger = new Logger(AliyunVoiceCallbackService.name);

    async handleCallback(req: Request, payload: unknown) {
        const reports = await this.parsePayload(req, payload);

        if (!reports.length) {
            this.logger.warn('收到空的阿里云语音回执');
            return;
        }

        for (const report of reports) {
            await this.processReport(report);
        }
    }

    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly dispatcher: NotificationDispatcher,
    ) {}

    private async processReport(report: AliyunVoiceReportDto) {
        const delivery = await this.findOrCreateVoiceDelivery(report);
        if (!delivery) {
            this.logger.warn(
                `阿里云语音回执未找到关联记录 outId=${report.out_id ?? 'none'} callId=${report.call_id ?? 'none'}`,
            );
            return;
        }

        const nextContext = this.buildNextContext(delivery.context, report);
        const status = this.resolveStatus(delivery.status, report);
        const deliveredAt = this.resolveDeliveredAt(
            report,
            delivery.deliveredAt,
        );

        await this.notificationRepository.updateVoiceDeliveryLog(delivery.id, {
            callId: report.call_id ?? delivery.callId ?? null,
            status,
            lastError: status === 'failed' ? this.buildLastError(report) : null,
            providerStatusCode: this.buildProviderStatusCode(report),
            providerStatusMessage: this.buildProviderStatusMessage(report),
            deliveredAt,
            context: nextContext,
        });

        if (!this.shouldTriggerSmsFallback(delivery, status, nextContext)) {
            return;
        }

        const fallbackResult = await this.dispatchSmsFallback(delivery);
        const contextWithFallback = this.appendFallbackContext(
            nextContext,
            fallbackResult,
        );
        await this.notificationRepository.updateVoiceDeliveryLog(delivery.id, {
            context: contextWithFallback,
        });
    }

    private async findOrCreateVoiceDelivery(report: AliyunVoiceReportDto) {
        const existing =
            await this.notificationRepository.getVoiceDeliveryWithDetails({
                outId: report.out_id,
                callId: report.call_id,
            });
        if (existing) {
            return existing;
        }

        const parsedOutId = this.parseOutId(report.out_id);
        if (!parsedOutId) {
            return null;
        }

        await this.notificationRepository.createVoiceDeliveryLog({
            notificationId: parsedOutId.notificationId,
            targetRecordId: parsedOutId.targetRecordId,
            outId: parsedOutId.outId,
            callId: report.call_id ?? null,
            status: 'pending',
            context: {
                backfilledFromCallback: true,
            },
        });

        return this.notificationRepository.getVoiceDeliveryWithDetails({
            outId: parsedOutId.outId,
            callId: report.call_id,
        });
    }

    private buildNextContext(
        existing: NotificationMetadata | null | undefined,
        report: AliyunVoiceReportDto,
    ): NotificationMetadata {
        const context = this.cloneContext(existing);
        context.voiceReport = {
            outId: report.out_id ?? null,
            callId: report.call_id ?? null,
            requestId: report.request_id ?? null,
            code: report.code ?? null,
            statusCode: report.status_code ?? null,
            statusMessage: report.status_msg ?? null,
            smartStatus: report.smart_status ?? null,
            smartStatusCode: report.smart_status_code ?? null,
            duration: this.normalizeDuration(report.duration),
            calledNumber: report.called_number ?? null,
            templateCode: report.template_code ?? report.voice_code ?? null,
            startTime: report.start_time ?? null,
            endTime: report.end_time ?? null,
            hangupTime: report.hangup_time ?? null,
            dtmf: report.dtmf ?? null,
            receivedAt: new Date().toISOString(),
            rawPayload: report,
        };
        return context;
    }

    private resolveStatus(
        currentStatus: NotificationDeliveryStatus,
        report: AliyunVoiceReportDto,
    ): NotificationDeliveryStatus {
        const incomingStatus = this.mapStatusFromReport(report);

        if (currentStatus === 'delivered') {
            return currentStatus;
        }
        if (incomingStatus === 'delivered') {
            return incomingStatus;
        }
        if (currentStatus === 'failed' && incomingStatus === 'sent') {
            return currentStatus;
        }
        return incomingStatus;
    }

    private mapStatusFromReport(
        report: AliyunVoiceReportDto,
    ): NotificationDeliveryStatus {
        if (report.status_code === '200000') {
            return 'delivered';
        }
        if (report.status_code?.trim()) {
            return 'failed';
        }
        if (report.smart_status_code === 'ANSWERED') {
            return 'sent';
        }
        return 'sent';
    }

    private resolveDeliveredAt(
        report: AliyunVoiceReportDto,
        currentDeliveredAt: Date | null,
    ) {
        if (currentDeliveredAt) {
            return currentDeliveredAt;
        }

        const candidate =
            this.toDate(report.end_time) ??
            this.toDate(report.hangup_time) ??
            this.toDate(report.start_time);

        return (
            candidate ?? (report.status_code === '200000' ? new Date() : null)
        );
    }

    private buildLastError(report: AliyunVoiceReportDto) {
        return (
            report.status_msg?.trim() ??
            report.smart_status?.trim() ??
            report.status_code?.trim() ??
            report.smart_status_code?.trim() ??
            report.code?.trim() ??
            '语音回执失败'
        );
    }

    private buildProviderStatusCode(report: AliyunVoiceReportDto) {
        return (
            report.status_code?.trim() ??
            report.smart_status_code?.trim() ??
            report.code?.trim() ??
            null
        );
    }

    private buildProviderStatusMessage(report: AliyunVoiceReportDto) {
        return report.status_msg?.trim() ?? report.smart_status?.trim() ?? null;
    }

    private shouldTriggerSmsFallback(
        delivery: VoiceDeliveryWithRelations,
        status: NotificationDeliveryStatus,
        context: NotificationMetadata,
    ) {
        if (status !== 'failed') {
            return false;
        }
        if (!delivery.notification || !delivery.target) {
            this.logger.warn('语音回执缺少关联通知或目标，无法触发短信兜底');
            return false;
        }

        const fallback = this.toRecord(context.fallback);
        return fallback.smsTriggered !== true;
    }

    private async dispatchSmsFallback(
        delivery: VoiceDeliveryWithRelations,
    ): Promise<SmsFallbackResult> {
        if (!delivery.notification || !delivery.target) {
            return {
                success: false,
                error: '缺少通知或目标信息',
            };
        }
        try {
            const results = await this.dispatcher.dispatchPlanForTarget({
                notification: delivery.notification,
                target: delivery.target,
                plan: [{ channel: 'sms' }],
            });
            const success = results.some(
                (result) => result.status === 'success',
            );
            return { success, results };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `通知 ${delivery.notification.id} 触发语音失败短信兜底失败`,
                message,
            );
            return { success: false, error: message };
        }
    }

    private appendFallbackContext(
        context: NotificationMetadata,
        fallback: SmsFallbackResult,
    ): NotificationMetadata {
        const clone = this.cloneContext(context);
        const fallbackContext = this.toRecord(clone.fallback);
        fallbackContext.smsTriggered = true;
        fallbackContext.smsTriggeredAt = new Date().toISOString();
        fallbackContext.smsSuccess = fallback.success;
        if (fallback.error) {
            fallbackContext.smsError = fallback.error;
        }
        if (fallback.results?.length) {
            fallbackContext.smsResults = fallback.results.map((result) => ({
                channel: result.channel,
                status: result.status,
                detail: result.detail,
                error: result.error,
            }));
        }
        clone.fallback = fallbackContext;
        return clone;
    }

    private async parsePayload(
        req: Request,
        payload: unknown,
    ): Promise<AliyunVoiceReportDto[]> {
        const rawValue = await this.normalizeRawPayload(req, payload);
        const parsed = AliyunVoiceCallbackPayloadSchema.safeParse(rawValue);

        if (!parsed.success) {
            throw new BadRequestException('阿里云语音回调 payload 不合法');
        }

        return Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    }

    private async normalizeRawPayload(req: Request, payload: unknown) {
        if (
            payload &&
            typeof payload === 'object' &&
            !Buffer.isBuffer(payload)
        ) {
            return payload;
        }

        const raw = await this.readRawBody(req, payload);
        if (!raw.trim()) {
            return [];
        }

        try {
            return JSON.parse(raw);
        } catch {
            throw new BadRequestException('阿里云语音回调 body 不是合法 JSON');
        }
    }

    private async readRawBody(req: Request, payload: unknown) {
        if (typeof payload === 'string') {
            return payload;
        }
        if (Buffer.isBuffer(payload)) {
            return payload.toString('utf8');
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
            );
        }
        return Buffer.concat(chunks).toString('utf8');
    }

    private parseOutId(outId?: string) {
        if (!outId) {
            return null;
        }
        const [prefix, notificationId, , targetRecordId] = outId.split(':');
        if (prefix !== 'voice' || !notificationId || !targetRecordId) {
            return null;
        }
        return {
            outId,
            notificationId,
            targetRecordId,
        };
    }

    private toDate(value?: string) {
        if (!value) {
            return null;
        }
        const normalized = value.replace(' ', 'T');
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private normalizeDuration(value: string | number | undefined) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    private cloneContext(
        context: NotificationMetadata | null | undefined,
    ): NotificationMetadata {
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            return {};
        }
        return { ...context };
    }

    private toRecord(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return { ...(value as Record<string, unknown>) };
    }
}
