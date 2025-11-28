import { Module, forwardRef } from '@nestjs/common';
import { PayService } from './pay.service';
import { PayController } from './pay.controller';
import { PayRepository } from './pay.repository';
import { OrderModule } from '../order/order.module';
import { AdminRevenueLogsController } from './admin-revenue-logs.controller';
import { AdminRevenueLogsService } from './admin-revenue-logs.service';
import { AdminRevenueLogsRepository } from './admin-revenue-logs.repository';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { AdminWithdrawalsRepository } from './admin-withdrawals.repository';

@Module({
    controllers: [
        PayController,
        AdminRevenueLogsController,
        AdminWithdrawalsController,
    ],
    providers: [
        PayService,
        PayRepository,
        AdminRevenueLogsService,
        AdminRevenueLogsRepository,
        AdminWithdrawalsService,
        AdminWithdrawalsRepository,
    ],
    imports: [forwardRef(() => OrderModule)],
    exports: [PayService],
})
export class PayModule {}
