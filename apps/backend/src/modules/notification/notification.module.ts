import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SmsModule } from 'src/common/sms/sms.module';
import { VoiceCallModule } from 'src/common/voice';
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
import { NotificationTemplateService } from './notification-template.service';
import { SmsCallbackController } from './sms-callback.controller';
import { SmsCallbackService } from './sms-callback.service';
import { NotificationVoiceCallService } from './notification-voice-call.service';
import { AliyunVoiceCallbackController } from './aliyun-voice-callback.controller';
import { AliyunVoiceCallbackService } from './aliyun-voice-callback.service';

@Module({
    imports: [ConfigModule, SmsModule, VoiceCallModule],
    controllers: [
        NotificationController,
        TencentPushCallbackController,
        SmsCallbackController,
        AliyunVoiceCallbackController,
        // VoiceCallController,
    ],
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
        NotificationVoiceCallService,
        NotificationRepository,
        NotificationTemplateService,
        SmsCallbackService,
        AliyunVoiceCallbackService,
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
    exports: [
        NotificationPublisher,
        NotificationWsService,
        NotificationTemplateService,
    ],
})
export class NotificationModule {}
