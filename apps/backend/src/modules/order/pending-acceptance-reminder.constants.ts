export const PendingAcceptanceReminderRedisKeys = {
    scheduleZset: 'order:pending-acceptance:reminders',
    lockPrefix: 'lock:pending-acceptance:',
} as const;

export type PendingAcceptanceReminderStage =
    | 'warning_60'
    | 'warning_30'
    | 'warning_15'
    | 'auto_cancel';

export type PendingAcceptanceWarningLevel = 'mild' | 'serious' | 'critical';

export interface PendingAcceptanceReminderDefinition {
    stage: PendingAcceptanceReminderStage;
    offsetMs: number;
    warningLevel: PendingAcceptanceWarningLevel;
    escalateLabel: string;
}

export const PENDING_ACCEPTANCE_REMINDER_SEQUENCE: readonly PendingAcceptanceReminderDefinition[] =
    [
        {
            stage: 'warning_60',
            offsetMs: 60 * 60 * 1000,
            warningLevel: 'mild',
            escalateLabel: '还有 1 小时将自动取消，请尽快处理',
        },
        {
            stage: 'warning_30',
            offsetMs: 30 * 60 * 1000,
            warningLevel: 'serious',
            escalateLabel: '剩余 30 分钟，请立即确认是否接单',
        },
        {
            stage: 'warning_15',
            offsetMs: 15 * 60 * 1000,
            warningLevel: 'critical',
            escalateLabel: '最后 15 分钟，若仍未响应将自动取消',
        },
        {
            stage: 'auto_cancel',
            offsetMs: 0,
            warningLevel: 'critical',
            escalateLabel: '已达到最晚处理时间，系统将自动取消订单',
        },
    ] as const;

export interface PendingAcceptanceReminderTask {
    orderId: string;
    assignmentId: string;
    stage: PendingAcceptanceReminderStage;
    deadline: string;
    scheduledAt: string;
    warningLevel: PendingAcceptanceWarningLevel;
}
