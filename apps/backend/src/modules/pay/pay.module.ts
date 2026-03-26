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
import { AlipayPaymentProvider } from './providers/alipay-payment.provider';
import { AlipayPayoutProvider } from './providers/alipay-payout.provider';
import { AlipayRefundProvider } from './providers/alipay-refund.provider';
import { PaymentDispatcher } from './providers/payment.dispatcher';
import { PAYMENT_PROVIDERS } from './providers/payment-provider.interface';
import { PayoutDispatcher } from './providers/payout.dispatcher';
import { PAYOUT_PROVIDERS } from './providers/payout-provider.interface';
import { RefundDispatcher } from './providers/refund.dispatcher';
import { REFUND_PROVIDERS } from './providers/refund-provider.interface';
import { WechatPaymentProvider } from './providers/wechat-payment.provider';

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
        AlipayPaymentProvider,
        WechatPaymentProvider,
        AlipayPayoutProvider,
        AlipayRefundProvider,
        PaymentDispatcher,
        PayoutDispatcher,
        RefundDispatcher,
        {
            provide: PAYMENT_PROVIDERS,
            useFactory: (
                alipayPaymentProvider: AlipayPaymentProvider,
                wechatPaymentProvider: WechatPaymentProvider,
            ) => [alipayPaymentProvider, wechatPaymentProvider],
            inject: [AlipayPaymentProvider, WechatPaymentProvider],
        },
        {
            provide: PAYOUT_PROVIDERS,
            useFactory: (alipayPayoutProvider: AlipayPayoutProvider) => [
                alipayPayoutProvider,
            ],
            inject: [AlipayPayoutProvider],
        },
        {
            provide: REFUND_PROVIDERS,
            useFactory: (alipayRefundProvider: AlipayRefundProvider) => [
                alipayRefundProvider,
            ],
            inject: [AlipayRefundProvider],
        },
    ],
    imports: [forwardRef(() => OrderModule)],
    exports: [PayService],
})
export class PayModule {}
