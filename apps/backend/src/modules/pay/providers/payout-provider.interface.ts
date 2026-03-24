import { paymentMethodEnum } from 'src/common/database/schema/enums';
import { withdrawals } from 'src/common/database/schema/financial';

export type PayoutChannel = (typeof paymentMethodEnum.enumValues)[number];
export type WithdrawalRecord = typeof withdrawals.$inferSelect;

export type PayoutProviderExecuteRequest = {
    withdrawal: WithdrawalRecord;
};

export type PayoutProviderQueryRequest = {
    withdrawal: WithdrawalRecord;
};

export type PayoutProviderExecuteResult = {
    channel: PayoutChannel;
    withdrawalStatus:
        | 'approved'
        | 'processing'
        | 'completed'
        | 'failed'
        | 'cancelled';
    referenceId?: string | null;
    providerState?: string | null;
    providerAppId?: string | null;
    providerBillNo?: string | null;
    providerPackageInfo?: string | null;
    providerMeta?: Record<string, unknown> | null;
    failureReason?: string | null;
    processedAt?: Date;
};

export interface PayoutProvider {
    readonly channel: PayoutChannel;

    executePayout(
        request: PayoutProviderExecuteRequest,
    ): Promise<PayoutProviderExecuteResult>;

    queryPayoutStatus?(
        request: PayoutProviderQueryRequest,
    ): Promise<PayoutProviderExecuteResult | null>;
}

export const PAYOUT_PROVIDERS = Symbol('PAYOUT_PROVIDERS');
