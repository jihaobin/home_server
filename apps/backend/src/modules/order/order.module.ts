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
import { OrderNotifySseService } from './order-notify-sse.service';
import { OrderEventsController } from './order-events.controller';
import { OrderNotifyRelayService } from './workers/order-notify-relay.service';

@Module({
    controllers: [OrderController, OrderEventsController],
    providers: [
        OrderService,
        OrderRepository,
        OrderCheckinService,
        OrderCheckinRepository,
        GeoLocationService,
        OrderExpireScannerService,
        OrderExpireConsumerService,
        OrderNotifySseService,
        OrderNotifyRelayService,
    ],
    imports: [
        ConfigModule,
        ServiceModule,
        WorkSkillModule,
        forwardRef(() => PayModule),
    ],
    exports: [OrderService, OrderCheckinService],
})
export class OrderModule {}
