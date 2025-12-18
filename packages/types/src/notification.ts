import { z } from 'zod';

import type {
    NotificationChannel,
    NotificationChannelPlanItem,
    NotificationDeliveryMode,
    NotificationPriority,
    NotificationTargetType,
    NotificationTraceLevel,
} from './database-entity';

export type NotificationChannelType = NotificationChannel;

export interface NotificationTargetDescriptor {
    targetId?: string;
    userId?: string;
    targetType?: NotificationTargetType;
    metadata?: Record<string, string>;
    channelPlan?: NotificationChannelPlanItem[];
}

export interface NotificationCommand<TPayload = NotificationEventPayload> {
    event: string;
    targets?: NotificationTargetDescriptor[];
    payload: TPayload;
    priority?: NotificationPriority;
    metadata?: Record<string, string>;
    fallbackPlan?: NotificationChannelPlanItem[];
    deliveryMode?: NotificationDeliveryMode;
    traceLevel?: NotificationTraceLevel;
    traceContext?: Record<string, unknown>;
    availableAt?: Date;
    expiresAt?: Date;
}

export interface NotificationEventPayload {
    event: string;
    notificationId?: string;
    eventId?: string;
    deliveryId?: string;
    orderId?: string;
    status?: string;
    message?: string;
    appointmentTime?: string;
    serviceName?: string;
    totalAmount?: string;
    warningType?: string;
    warningLevel?: string;
    cancelReason?: string;
    assignmentType?: string;
    triggeredAt?: string;
    decisionStatus?: string;
    operatorId?: string;
    targetId?: string;
    userId?: string;
    channelPlan?: string;
    deliveryMode?: NotificationDeliveryMode;
    deliveryChannel?: NotificationChannelType;
    [key: string]: string | undefined;
}

export type NotificationChannelStatus =
    | 'success'
    | 'skipped'
    | 'unavailable'
    | 'failed';

export interface NotificationChannelContext {
    payload: NotificationEventPayload;
    target?: NotificationTargetDescriptor;
    deliveryMode?: NotificationDeliveryMode;
    deliveryId?: string;
}

export interface NotificationChannelResult {
    channel: NotificationChannelType;
    status: NotificationChannelStatus;
    detail?: string;
    error?: string;
}

export const NotificationAckSchema = z.object({
    deliveryId: z.string().min(1, 'deliveryId 不能为空').max(255),
});

export type NotificationAckDto = z.infer<typeof NotificationAckSchema>;

export const NotificationHeartbeatSchema = z.object({
    deviceId: z.string().max(255).optional(),
    platform: z.enum(['ios', 'android', 'web', 'unknown']).optional(),
    appVersion: z.string().max(64).optional(),
    connectionId: z.string().max(255).optional(),
    registrationId: z.string().max(512).optional(),
});

export type NotificationHeartbeatDto = z.infer<
    typeof NotificationHeartbeatSchema
>;
export { NotificationDeviceInfoSchema } from './database-entity';
export type { NotificationDeviceInfo } from './database-entity';

export const NOTIFICATION_SOCKET_SERVER_EVENT =
    'notifications:message' as const;
export const NOTIFICATION_SOCKET_CLIENT_EVENT =
    'notifications:client' as const;

export enum NotificationSocketEventType {
    Notification = 'notification',
    ConnectionAck = 'connection_ack',
    HeartbeatAck = 'heartbeat_ack',
    Error = 'error',
}

export enum NotificationSocketClientEventType {
    Heartbeat = 'heartbeat',
    Offline = 'offline',
}

export type NotificationSocketServerMessage =
    | {
          type: NotificationSocketEventType.Notification;
          event: string;
          payload: NotificationEventPayload;
          deliveryId?: string;
          deliveryMode?: NotificationDeliveryMode;
      }
    | {
          type: NotificationSocketEventType.ConnectionAck;
          connectionId: string;
      }
    | {
          type: NotificationSocketEventType.HeartbeatAck;
          timestamp: string;
      }
    | {
          type: NotificationSocketEventType.Error;
          code: string;
          message: string;
      };

type NotificationSocketClientPayload = {
    timestamp?: string;
    platform?: NotificationHeartbeatDto['platform'];
    deviceId?: string;
    appVersion?: string;
    registrationId?: string;
};

export type NotificationSocketClientMessage =
    | (NotificationSocketClientPayload & {
          type: NotificationSocketClientEventType.Heartbeat;
      })
    | (NotificationSocketClientPayload & {
          type: NotificationSocketClientEventType.Offline;
      });
