import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import {
    PAYMENT_PROVIDERS,
    type PaymentChannel,
    type PaymentProvider,
    type PaymentProviderInitiateRequest,
    type PaymentProviderInitiateResult,
    type PaymentProviderNotifyResult,
    type PaymentProviderQueryRequest,
    type PaymentProviderStatusResult,
} from './payment-provider.interface';

@Injectable()
export class PaymentDispatcher {
    private readonly logger = new Logger(PaymentDispatcher.name);

    constructor(
        @Inject(PAYMENT_PROVIDERS)
        private readonly providers: PaymentProvider[],
    ) {}

    private getProvider(channel: PaymentChannel): PaymentProvider {
        const provider = this.providers.find(
            (item) => item.channel === channel,
        );

        if (!provider) {
            throw new BadRequestException(`暂不支持 ${channel} 支付方式`);
        }

        return provider;
    }

    async initiatePayment(
        channel: PaymentChannel,
        request: PaymentProviderInitiateRequest,
    ): Promise<PaymentProviderInitiateResult> {
        const provider = this.getProvider(channel);
        this.logger.log(`[PaymentDispatcher] 使用 ${channel} 发起支付`);
        return provider.initiatePayment(request);
    }

    async queryPaymentStatus(
        channel: PaymentChannel,
        request: PaymentProviderQueryRequest,
    ): Promise<PaymentProviderStatusResult> {
        const provider = this.getProvider(channel);
        return provider.queryPaymentStatus(request);
    }

    async handleNotify(
        channel: PaymentChannel,
        payload: unknown,
    ): Promise<PaymentProviderNotifyResult> {
        const provider = this.getProvider(channel);
        if (!provider.handleNotify) {
            throw new BadRequestException(`暂不支持 ${channel} 支付回调`);
        }

        return provider.handleNotify(payload);
    }
}
