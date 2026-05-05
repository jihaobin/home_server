import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NotificationTemplateKey =
    | 'order_pending_acceptance_assigned'
    | 'order_assignment_decision_accepted'
    | 'order_cancelled'
    | 'order_payment_expired'
    | 'order_pending_acceptance_warning'
    | 'order_service_eta_warning'
    | 'withdrawal_wechat_wait_user_confirm';

const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, string> =
    {
        order_pending_acceptance_assigned:
            '有新的订单需要处理，请尽快确认是否接单',
        order_assignment_decision_accepted: '服务人员已接单',
        order_cancelled: '订单已取消：{{reason}}',
        order_payment_expired: '订单支付超时，系统自动取消',
        order_pending_acceptance_warning: '{{orderLabel}} {{escalateLabel}}',
        order_service_eta_warning: '{{orderLabel}} {{escalateLabel}}',
        withdrawal_wechat_wait_user_confirm:
            '微信提现审核已通过，请打开 App 在微信中确认收款。',
    };

@Injectable()
export class NotificationTemplateService {
    constructor(private readonly configService: ConfigService) {}

    getTemplate(
        key: NotificationTemplateKey,
        context?: Record<string, string | number | undefined | null>,
    ): string {
        const override = this.configService.get<string>(this.toEnvKey(key));
        const template =
            override && override.trim().length
                ? override
                : DEFAULT_NOTIFICATION_TEMPLATES[key];
        return this.interpolate(template, context);
    }

    private interpolate(
        template: string,
        context?: Record<string, string | number | undefined | null>,
    ): string {
        if (!context) {
            return template;
        }
        return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => {
            const value = context[name];
            if (value === undefined || value === null) {
                return '';
            }
            return String(value);
        });
    }

    private toEnvKey(key: NotificationTemplateKey) {
        return `NOTIFICATION_TEMPLATE_${key.toUpperCase()}`;
    }
}
