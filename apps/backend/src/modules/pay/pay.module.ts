import { Module, forwardRef } from '@nestjs/common';
import { PayService } from './pay.service';
import { PayController } from './pay.controller';
import { PayRepository } from './pay.repository';
import { OrderModule } from '../order/order.module';
import { AdminRevenueLogsController } from './admin-revenue-logs.controller';
import { AdminRevenueLogsService } from './admin-revenue-logs.service';
import { AdminRevenueLogsRepository } from './admin-revenue-logs.repository';

@Module({
    controllers: [PayController, AdminRevenueLogsController],
    providers: [
        PayService,
        PayRepository,
        AdminRevenueLogsService,
        AdminRevenueLogsRepository,
    ],
    imports: [forwardRef(() => OrderModule)],
    exports: [PayService],
})
export class PayModule {}
