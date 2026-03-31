import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
    PAYOUT_PROVIDERS,
    type PayoutProviderCancelRequest,
    type PayoutChannel,
    type PayoutProvider,
    type PayoutProviderExecuteRequest,
    type PayoutProviderExecuteResult,
    type PayoutProviderNotifyRequest,
    type PayoutProviderQueryRequest,
} from './payout-provider.interface';

@Injectable()
export class PayoutDispatcher {
    constructor(
        @Inject(PAYOUT_PROVIDERS)
        private readonly providers: PayoutProvider[],
    ) {}

    private getProvider(channel: PayoutChannel): PayoutProvider {
        const provider = this.providers.find(
            (item) => item.channel === channel,
        );

        if (!provider) {
            throw new BadRequestException(`暂不支持 ${channel} 打款方式`);
        }

        return provider;
    }

    async executePayout(
        channel: PayoutChannel,
        request: PayoutProviderExecuteRequest,
    ): Promise<PayoutProviderExecuteResult> {
        return this.getProvider(channel).executePayout(request);
    }

    async queryPayoutStatus(
        channel: PayoutChannel,
        request: PayoutProviderQueryRequest,
    ): Promise<PayoutProviderExecuteResult | null> {
        const provider = this.getProvider(channel);
        if (!provider.queryPayoutStatus) {
            return null;
        }

        return provider.queryPayoutStatus(request);
    }

    async cancelPayout(
        channel: PayoutChannel,
        request: PayoutProviderCancelRequest,
    ): Promise<PayoutProviderExecuteResult | null> {
        const provider = this.getProvider(channel);
        if (!provider.cancelPayout) {
            return null;
        }

        return provider.cancelPayout(request);
    }

    async handleNotify(
        channel: PayoutChannel,
        request: PayoutProviderNotifyRequest,
    ): Promise<PayoutProviderExecuteResult | null> {
        const provider = this.getProvider(channel);
        if (!provider.handleNotify) {
            return null;
        }

        return provider.handleNotify(request);
    }
}
