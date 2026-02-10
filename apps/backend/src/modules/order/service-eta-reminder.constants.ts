export const ServiceEtaReminderRedisKeys = {
    scheduleZset: 'order:service-eta:reminders',
    lockPrefix: 'lock:service-eta:',
} as const;

export type ServiceEtaReminderStage = 'eta_60' | 'eta_30' | 'eta_15';

export type ServiceEtaWarningLevel = 'mild' | 'serious' | 'critical';

export interface ServiceEtaReminderDefinition {
    stage: ServiceEtaReminderStage;
    offsetMs: number;
    warningLevel: ServiceEtaWarningLevel;
    escalateLabel: string;
}

export const SERVICE_ETA_REMINDER_SEQUENCE: readonly ServiceEtaReminderDefinition[] =
    [
        {
            stage: 'eta_60',
            offsetMs: 60 * 60 * 1000,
            warningLevel: 'mild',
            escalateLabel: '还有 1 小时，请提前规划行程确保准时到达客户地点',
        },
        {
            stage: 'eta_30',
            offsetMs: 30 * 60 * 1000,
            warningLevel: 'serious',
            escalateLabel: '还有 30 分钟将开始服务，请尽快出发',
        },
        {
            stage: 'eta_15',
            offsetMs: 15 * 60 * 1000,
            warningLevel: 'critical',
            escalateLabel: '仅剩 15 分钟，请确保准时到达客户地点',
        },
    ] as const;

export interface ServiceEtaReminderTask {
    orderId: string;
    assignmentId: string;
    stage: ServiceEtaReminderStage;
    appointmentTime: string;
    appointmentWindowEndTime?: string;
    scheduledAt: string;
    warningLevel: ServiceEtaWarningLevel;
}
