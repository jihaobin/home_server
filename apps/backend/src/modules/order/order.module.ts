import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GeoLocationService } from 'src/common/services/geo-location.service';
import { ServiceModule } from '../service/service.module';
import { WorkSkillModule } from '../work-skill/work-skill.module';
import { PayModule } from '../pay/pay.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderCheckinService } from './order-checkin.service';
import { OrderCheckinRepository } from './order-checkin.repository';
import { OrderRepository } from './order.reposityro';
import { OrderExpireScannerService } from './workers/order-expire-scanner.service';
import { OrderExpireConsumerService } from './workers/order-expire-consumer.service';
import { PendingAcceptanceReminderWorker } from './workers/pending-acceptance-reminder.worker';
import { ServiceEtaReminderWorker } from './workers/service-eta-reminder.worker';
import { NotificationModule } from '../notification/notification.module';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';

@Module({
    controllers: [OrderController],
    providers: [
        OrderService,
        OrderRepository,
        OrderCheckinService,
        OrderCheckinRepository,
        GeoLocationService,
        OrderExpireScannerService,
        OrderExpireConsumerService,
        PendingAcceptanceReminderWorker,
        ServiceEtaReminderWorker,
        S3StoreServer,
    ],
    imports: [
        ConfigModule,
        ServiceModule,
        WorkSkillModule,
        NotificationModule,
        forwardRef(() => PayModule),
    ],
    exports: [OrderService, OrderCheckinService, OrderRepository],
})
export class OrderModule {}
