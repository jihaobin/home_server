import { Module } from '@nestjs/common';

import { SmsModule } from 'src/common/sms/sms.module';
import { NotificationWsGateway } from './notification-ws.gateway';
import { NotificationPublisher } from './notification.publisher';
import { NotificationRelayService } from './workers/notification-relay.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NOTIFICATION_CHANNELS } from './notification.constants';
import { InAppChannel } from './channels/in-app.channel';
import { TencentCloudPushChannel } from './channels/tencent-cloud-push.channel/tencent-cloud-push.channel';
import { SmsChannel } from './channels/sms.channel';
import { NotificationClientService } from './notification-client.service';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationOutboxRelayService } from './workers/notification-outbox-relay.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationPreferenceSeeder } from './notification-preference.seeder';
import { NotificationPresenceService } from './notification-presence.service';
import { NotificationWsService } from './notification-ws.service';
import { NotificationDeviceService } from './notification-device.service';
import { TencentCloudPushService } from './channels/tencent-cloud-push.channel/tencent-cloud-push.service';
import { TencentPushCallbackService } from './tencent-push-callback.service';
import { TencentPushCallbackController } from './tencent-push-callback.controller';
import { NotificationMetricsService } from './notification-metrics.service';
import { NotificationRetryService } from './notification-retry.service';

@Module({
    imports: [SmsModule],
    controllers: [NotificationController, TencentPushCallbackController],
    providers: [
        NotificationPublisher,
        NotificationRelayService,
        NotificationOutboxRelayService,
        NotificationDispatcher,
        NotificationMetricsService,
        NotificationClientService,
        NotificationPreferenceService,
        NotificationPreferenceSeeder,
        NotificationPresenceService,
        NotificationWsService,
        NotificationWsGateway,
        NotificationDeviceService,
        TencentCloudPushService,
        TencentPushCallbackService,
        InAppChannel,
        TencentCloudPushChannel,
        SmsChannel,
        NotificationRetryService,
        NotificationRepository,
        {
            provide: NOTIFICATION_CHANNELS,
            useFactory: (
                inAppChannel: InAppChannel,
                tencentCloudPushChannel: TencentCloudPushChannel,
                smsChannel: SmsChannel,
            ) => [inAppChannel, tencentCloudPushChannel, smsChannel],
            inject: [InAppChannel, TencentCloudPushChannel, SmsChannel],
        },
    ],
    exports: [NotificationPublisher, NotificationWsService],
})
export class NotificationModule {}
