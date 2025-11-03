import { Module, forwardRef } from '@nestjs/common';
import { PayService } from './pay.service';
import { PayController } from './pay.controller';
import { PayRepository } from './pay.repository';
import { OrderModule } from '../order/order.module';

@Module({
    controllers: [PayController],
    providers: [PayService, PayRepository],
    imports: [forwardRef(() => OrderModule)],
    exports: [PayService],
})
export class PayModule {}
