import { Injectable, Logger } from '@nestjs/common';

import { NotificationRepository } from './notification.repository';

interface SmsReportPayload {
    phone_number?: string;
    send_time?: string;
    report_time?: string;
    success?: boolean;
    err_code?: string;
    err_msg?: string;
    sms_size?: string;
    biz_id?: string;
    out_id?: string;
}

@Injectable()
export class SmsCallbackService {
    private readonly logger = new Logger(SmsCallbackService.name);

    constructor(
        private readonly notificationRepository: NotificationRepository,
    ) {}

    async handleReports(payload: unknown) {
        const reports = this.normalizePayload(payload);
        if (!reports.length) {
            this.logger.warn('收到空的短信回执');
            return;
        }
        for (const report of reports) {
            await this.handleReport(report);
        }
    }

    private async handleReport(report: SmsReportPayload) {
        const deliveryId = report.out_id ?? report.biz_id;
        if (!deliveryId) {
            this.logger.warn('短信回执缺少 out_id/biz_id，无法匹配投递记录');
            return;
        }
        const status = report.success === true ? 'delivered' : 'failed';
        const deliveredAt = report.report_time
            ? this.toDate(report.report_time)
            : new Date();
        const lastError =
            status === 'failed'
                ? report.err_msg || report.err_code || '短信发送失败'
                : null;
        const context = {
            smsReport: {
                phoneNumber: report.phone_number,
                sendTime: report.send_time,
                reportTime: report.report_time,
                success: report.success,
                errCode: report.err_code,
                errMsg: report.err_msg,
                smsSize: report.sms_size,
                bizId: report.biz_id,
                outId: report.out_id,
            },
        };
        await this.notificationRepository.updateDeliveryLog(deliveryId, {
            status,
            deliveredAt,
            lastError,
            context,
        });
    }

    private normalizePayload(payload: unknown): SmsReportPayload[] {
        if (Array.isArray(payload)) {
            return payload.filter(
                (item): item is SmsReportPayload =>
                    item && typeof item === 'object',
            );
        }
        if (payload && typeof payload === 'object') {
            return [payload as SmsReportPayload];
        }
        return [];
    }

    private toDate(value: string | undefined): Date {
        if (!value) {
            return new Date();
        }
        const normalized = value.replace(' ', 'T');
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
}
