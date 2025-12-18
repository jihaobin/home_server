import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import {
    REFUND_PROVIDERS,
    type RefundChannel,
    type RefundProvider,
    type RefundRequest,
    type RefundResult,
} from './refund.interface';

@Injectable()
export class RefundDispatcher {
    private readonly logger = new Logger(RefundDispatcher.name);

    constructor(
        @Inject(REFUND_PROVIDERS)
        private readonly providers: RefundProvider[],
    ) {}

    private getProvider(channel: RefundChannel): RefundProvider {
        const provider = this.providers.find(
            (item) => item.channel === channel,
        );

        if (!provider) {
            throw new BadRequestException(`暂不支持 ${channel} 退款方式`);
        }

        return provider;
    }

    async refund(
        channel: RefundChannel,
        request: RefundRequest,
    ): Promise<RefundResult> {
        const provider = this.getProvider(channel);
        this.logger.log(`[RefundDispatcher] 使用 ${channel} 退款供应商`);
        return provider.refund({
            ...request,
            channel,
        });
    }
}
