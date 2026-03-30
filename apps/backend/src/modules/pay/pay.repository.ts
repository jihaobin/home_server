import { Inject, Injectable } from '@nestjs/common';
import {
    TransactionType,
    WithdrawalStatus,
    WorkerEarningsRecordItem,
    WorkerEarningsRecordListResponse,
} from '@repo/types';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import {
    financialTransactions,
    payments,
    userBalances,
    withdrawals,
} from 'src/common/database/schema';

type PaymentInsert = typeof payments.$inferInsert;
type PaymentMethod = (typeof payments.paymentMethod.enumValues)[number];

type WithdrawalInsert = typeof withdrawals.$inferInsert;
type FinancialTransactionInsert = typeof financialTransactions.$inferInsert;

type Executor = DbType;

type FinancialTransactionQueryResult = {
    id: string;
    amount: string | null;
    currency: string | null;
    description: string | null;
    referenceId: string | null;
    transactionType: TransactionType;
    createdAt: Date | null;
    withdrawalId: string | null;
    withdrawalStatus: WithdrawalStatus | null;
    withdrawalReviewNote: string | null;
    withdrawalFailureReason: string | null;
    withdrawalProviderState: string | null;
    withdrawalProviderAppId: string | null;
    withdrawalProviderBillNo: string | null;
    withdrawalProviderPackageInfo: string | null;
    withdrawalProviderMeta: Record<string, unknown> | null;
    withdrawalRemark: string | null;
    withdrawalMethod: PaymentMethod | null;
    withdrawalRequestedAt: Date | null;
    withdrawalReviewedAt: Date | null;
    withdrawalProcessedAt: Date | null;
    withdrawalPayoutReferenceId: string | null;
};

type WithdrawalQueryResult = {
    id: string;
    amount: string | null;
    currency: string | null;
    status: WithdrawalStatus | null;
    method: PaymentMethod | null;
    remark: string | null;
    reviewNote: string | null;
    failureReason: string | null;
    requestedAt: Date | null;
    reviewedAt: Date | null;
    processedAt: Date | null;
    payoutReferenceId: string | null;
    providerState: string | null;
    providerAppId: string | null;
    providerBillNo: string | null;
    providerPackageInfo: string | null;
    providerMeta: Record<string, unknown> | null;
};

type MixedEarningsQueryResult = {
    source: 'financial' | 'withdrawal';
    id: string;
    amount: string | null;
    currency: string | null;
    transaction_type: TransactionType;
    description: string | null;
    reference_id: string | null;
    created_at: Date | null;
    status: WithdrawalStatus | null;
    method: PaymentMethod | null;
    remark: string | null;
    review_note: string | null;
    failure_reason: string | null;
    requested_at: Date | null;
    reviewed_at: Date | null;
    processed_at: Date | null;
    payout_reference_id: string | null;
    occurred_at: Date | null;
    total_count: string | null;
};

@Injectable()
export class PayRepository {
    @Inject(DB)
    private db: DbType;

    private getExecutor(executor?: Executor) {
        return executor ?? this.db;
    }

    findByOrderId(orderId: string, executor?: Executor) {
        const db = this.getExecutor(executor);
        return db.query.payments.findMany({
            where: eq(payments.orderId, orderId),
        });
    }

    async createPayment(data: PaymentInsert, executor?: Executor) {
        const db = this.getExecutor(executor);
        const [record] = await db.insert(payments).values(data).returning();
        return record ?? null;
    }

    async findLatestByOrderAndMethod(
        orderId: string,
        method: PaymentMethod,
        executor?: Executor,
    ) {
        const db = this.getExecutor(executor);
        const [record] = await db
            .select()
            .from(payments)
            .where(
                and(
                    eq(payments.orderId, orderId),
                    eq(payments.paymentMethod, method),
                ),
            )
            .orderBy(desc(payments.id))
            .limit(1);

        return record ?? null;
    }

    async updatePaymentById(
        id: string,
        data: Partial<Omit<PaymentInsert, 'id' | 'orderId'>>,
        executor?: Executor,
    ) {
        const db = this.getExecutor(executor);
        const [record] = await db
            .update(payments)
            .set(data)
            .where(eq(payments.id, id))
            .returning();

        return record ?? null;
    }

    findUserBalanceByUserId(userId: string, executor?: Executor) {
        const db = this.getExecutor(executor);
        return db.query.userBalances.findFirst({
            where: eq(userBalances.userId, userId),
        });
    }

    async updateUserBalanceById(
        id: string,
        data: Partial<Omit<typeof userBalances.$inferInsert, 'id' | 'userId'>>,
        executor?: Executor,
    ) {
        const db = this.getExecutor(executor);
        const [record] = await db
            .update(userBalances)
            .set(data)
            .where(eq(userBalances.id, id))
            .returning();

        return record ?? null;
    }

    async createWithdrawal(data: WithdrawalInsert, executor?: Executor) {
        const db = this.getExecutor(executor);
        const [record] = await db.insert(withdrawals).values(data).returning();
        return record ?? null;
    }

    findWithdrawalById(id: string, executor?: Executor) {
        const db = this.getExecutor(executor);
        return db.query.withdrawals.findFirst({
            where: eq(withdrawals.id, id),
        });
    }

    async updateWithdrawalById(
        id: string,
        data: Partial<Omit<WithdrawalInsert, 'id' | 'userId'>>,
        executor?: Executor,
    ) {
        const db = this.getExecutor(executor);
        const [record] = await db
            .update(withdrawals)
            .set(data)
            .where(eq(withdrawals.id, id))
            .returning();

        return record ?? null;
    }

    async updateWithdrawalByIdWithStatusGuard(
        id: string,
        expectedStatuses: WithdrawalStatus[],
        data: Partial<Omit<WithdrawalInsert, 'id' | 'userId'>>,
        executor?: Executor,
    ) {
        if (expectedStatuses.length === 0) {
            return null;
        }

        const db = this.getExecutor(executor);
        const [record] = await db
            .update(withdrawals)
            .set(data)
            .where(
                and(
                    eq(withdrawals.id, id),
                    inArray(withdrawals.status, expectedStatuses),
                ),
            )
            .returning();

        return record ?? null;
    }

    findWithdrawalsByStatuses(
        statuses: WithdrawalStatus[],
        limit = 100,
        executor?: Executor,
    ) {
        const db = this.getExecutor(executor);
        return db.query.withdrawals.findMany({
            where: inArray(withdrawals.status, statuses),
            orderBy: [desc(withdrawals.requestedAt)],
            limit,
        });
    }

    async createFinancialTransaction(
        data: FinancialTransactionInsert,
        executor?: Executor,
    ) {
        const db = this.getExecutor(executor);
        const [record] = await db
            .insert(financialTransactions)
            .values(data)
            .returning();

        return record ?? null;
    }

    async getMixedEarningsRecords(
        userId: string,
        options: { page: number; limit: number; offset: number },
    ): Promise<WorkerEarningsRecordListResponse> {
        const mixedRecordsQuery = sql<MixedEarningsQueryResult>`
            WITH mixed_records AS (
                SELECT
                    'financial' AS source,
                    ft.id,
                    ft.amount,
                    ft.currency,
                    ft.transaction_type,
                    ft.description,
                    ft.reference_id,
                    ft.created_at,
                    NULL::text AS status,
                    NULL::text AS method,
                    NULL::text AS remark,
                    NULL::text AS review_note,
                    NULL::text AS failure_reason,
                    NULL::timestamptz AS requested_at,
                    NULL::timestamptz AS reviewed_at,
                    NULL::timestamptz AS processed_at,
                    NULL::text AS payout_reference_id,
                    ft.created_at AS occurred_at
                FROM financial_transactions AS ft
                WHERE ft.user_id = ${userId}
                    AND ft.withdrawal_id IS NULL
                UNION ALL
                SELECT
                    'withdrawal' AS source,
                    w.id,
                    w.amount,
                    w.currency,
                    'withdrawal' AS transaction_type,
                    NULL::text AS description,
                    w.payout_reference_id AS reference_id,
                    w.requested_at AS created_at,
                    w.status::text AS status,
                    w.method::text AS method,
                    w.remark,
                    w.review_note,
                    w.failure_reason,
                    w.requested_at,
                    w.reviewed_at,
                    w.processed_at,
                    w.payout_reference_id,
                    w.requested_at AS occurred_at
                FROM withdrawals AS w
                WHERE w.user_id = ${userId}
            )
            SELECT
                source,
                id,
                amount,
                currency,
                transaction_type,
                description,
                reference_id,
                created_at,
                status,
                method,
                remark,
                review_note,
                failure_reason,
                requested_at,
                reviewed_at,
                processed_at,
                payout_reference_id,
                occurred_at,
                COUNT(*) OVER() AS total_count
            FROM mixed_records
            ORDER BY occurred_at DESC, source ASC, id DESC
            LIMIT ${options.limit}
            OFFSET ${options.offset};
        `;

        const result =
            await this.db.execute<MixedEarningsQueryResult>(mixedRecordsQuery);
        const rows = result.rows ?? [];
        const total = Number(rows[0]?.total_count ?? 0);
        const items = rows.map((row) => this.mapMixedEarningsRecord(row));

        return this.buildPaginatedResponse(items, {
            page: options.page,
            limit: options.limit,
            total,
        });
    }

    buildPaginatedResponse(
        items: WorkerEarningsRecordItem[],
        { page, limit, total }: { page: number; limit: number; total: number },
    ): WorkerEarningsRecordListResponse {
        const totalPages = Math.ceil(total / limit) || 0;
        return {
            items,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }

    private mapMixedEarningsRecord(
        row: MixedEarningsQueryResult,
    ): WorkerEarningsRecordItem {
        if (row.source === 'financial') {
            return this.mapFinancialTransactionRecord({
                id: row.id,
                amount: row.amount,
                currency: row.currency,
                description: row.description,
                referenceId: row.reference_id,
                transactionType: row.transaction_type,
                createdAt: row.created_at,
                withdrawalId: null,
                withdrawalStatus: null,
                withdrawalReviewNote: null,
                withdrawalFailureReason: null,
                withdrawalProviderState: null,
                withdrawalProviderAppId: null,
                withdrawalProviderBillNo: null,
                withdrawalProviderPackageInfo: null,
                withdrawalProviderMeta: null,
                withdrawalRemark: null,
                withdrawalMethod: null,
                withdrawalRequestedAt: null,
                withdrawalReviewedAt: null,
                withdrawalProcessedAt: null,
                withdrawalPayoutReferenceId: null,
            });
        }

        return this.mapWithdrawalRecord({
            id: row.id,
            amount: row.amount,
            currency: row.currency,
            status: (row.status as WithdrawalStatus) ?? null,
            method: (row.method as PaymentMethod) ?? null,
            remark: row.remark,
            reviewNote: row.review_note,
            failureReason: row.failure_reason,
            requestedAt: row.requested_at,
            reviewedAt: row.reviewed_at,
            processedAt: row.processed_at,
            payoutReferenceId: row.payout_reference_id,
            providerState: null,
            providerAppId: null,
            providerBillNo: null,
            providerPackageInfo: null,
            providerMeta: null,
        });
    }

    async queryFinancialTransactionRecords(
        userId: string,
        options: {
            limit: number;
            offset: number;
            flow: 'all' | 'income';
            excludeWithdrawalTransactions?: boolean;
        },
    ): Promise<{ items: WorkerEarningsRecordItem[]; total: number }> {
        const conditions = [eq(financialTransactions.userId, userId)];

        if (options.flow === 'income') {
            conditions.push(sql`${financialTransactions.amount} >= 0`);
        }

        if (options.excludeWithdrawalTransactions) {
            conditions.push(sql`${financialTransactions.withdrawalId} IS NULL`);
        }

        const whereClause =
            conditions.length > 1 ? and(...conditions) : conditions[0];

        const [records, totalResult] = await Promise.all([
            this.db
                .select({
                    id: financialTransactions.id,
                    amount: financialTransactions.amount,
                    currency: financialTransactions.currency,
                    description: financialTransactions.description,
                    referenceId: financialTransactions.referenceId,
                    transactionType: financialTransactions.transactionType,
                    createdAt: financialTransactions.createdAt,
                    withdrawalId: financialTransactions.withdrawalId,
                    withdrawalStatus: withdrawals.status,
                    withdrawalReviewNote: withdrawals.reviewNote,
                    withdrawalFailureReason: withdrawals.failureReason,
                    withdrawalProviderState: withdrawals.providerState,
                    withdrawalProviderAppId: withdrawals.providerAppId,
                    withdrawalProviderBillNo: withdrawals.providerBillNo,
                    withdrawalProviderPackageInfo:
                        withdrawals.providerPackageInfo,
                    withdrawalProviderMeta: withdrawals.providerMeta,
                    withdrawalRemark: withdrawals.remark,
                    withdrawalMethod: withdrawals.method,
                    withdrawalRequestedAt: withdrawals.requestedAt,
                    withdrawalReviewedAt: withdrawals.reviewedAt,
                    withdrawalProcessedAt: withdrawals.processedAt,
                    withdrawalPayoutReferenceId: withdrawals.payoutReferenceId,
                })
                .from(financialTransactions)
                .leftJoin(
                    withdrawals,
                    eq(financialTransactions.withdrawalId, withdrawals.id),
                )
                .where(whereClause)
                .orderBy(desc(financialTransactions.createdAt))
                .limit(options.limit)
                .offset(options.offset),
            this.db
                .select({
                    count: sql<string>`COUNT(*)`,
                })
                .from(financialTransactions)
                .where(whereClause),
        ]);

        const items = records.map((record) =>
            this.mapFinancialTransactionRecord(record),
        );

        return {
            items,
            total: Number(totalResult[0]?.count ?? 0),
        };
    }

    private mapFinancialTransactionRecord(
        record: FinancialTransactionQueryResult,
    ): WorkerEarningsRecordItem {
        const amountNumber = Number(record.amount ?? 0) || 0;
        const flowType: WorkerEarningsRecordItem['flowType'] =
            amountNumber >= 0 ? 'income' : 'withdrawal';

        return {
            id: record.id,
            flowType,
            transactionType: record.transactionType,
            amount: amountNumber,
            currency: record.currency ?? 'CNY',
            description: record.description ?? null,
            referenceId: record.referenceId ?? null,
            occurredAt: record.createdAt ?? new Date(),
            withdrawal: record.withdrawalId
                ? ({
                      id: record.withdrawalId,
                      status:
                          (record.withdrawalStatus as WithdrawalStatus) ??
                          'pending',
                      method:
                          (record.withdrawalMethod as PaymentMethod) ??
                          'alipay',
                      remark: record.withdrawalRemark ?? null,
                      reviewNote: record.withdrawalReviewNote ?? null,
                      failureReason: record.withdrawalFailureReason ?? null,
                      providerState: record.withdrawalProviderState ?? null,
                      providerAppId: record.withdrawalProviderAppId ?? null,
                      providerBillNo: record.withdrawalProviderBillNo ?? null,
                      providerPackageInfo:
                          record.withdrawalProviderPackageInfo ?? null,
                      providerMeta: record.withdrawalProviderMeta ?? null,
                      requestedAt:
                          record.withdrawalRequestedAt ??
                          record.createdAt ??
                          new Date(),
                      reviewedAt: record.withdrawalReviewedAt ?? null,
                      processedAt: record.withdrawalProcessedAt ?? null,
                  } as WorkerEarningsRecordItem['withdrawal'])
                : undefined,
        };
    }

    async queryWithdrawalRecords(
        userId: string,
        options: {
            limit: number;
            offset: number;
            status?: WithdrawalStatus;
        },
    ): Promise<{ items: WorkerEarningsRecordItem[]; total: number }> {
        const conditions = [eq(withdrawals.userId, userId)];

        if (options.status) {
            conditions.push(eq(withdrawals.status, options.status));
        }

        const whereClause =
            conditions.length > 1 ? and(...conditions) : conditions[0];

        const [records, totalResult] = await Promise.all([
            this.db
                .select({
                    id: withdrawals.id,
                    amount: withdrawals.amount,
                    currency: withdrawals.currency,
                    status: withdrawals.status,
                    method: withdrawals.method,
                    remark: withdrawals.remark,
                    reviewNote: withdrawals.reviewNote,
                    failureReason: withdrawals.failureReason,
                    requestedAt: withdrawals.requestedAt,
                    reviewedAt: withdrawals.reviewedAt,
                    processedAt: withdrawals.processedAt,
                    payoutReferenceId: withdrawals.payoutReferenceId,
                    providerState: withdrawals.providerState,
                    providerAppId: withdrawals.providerAppId,
                    providerBillNo: withdrawals.providerBillNo,
                    providerPackageInfo: withdrawals.providerPackageInfo,
                    providerMeta: withdrawals.providerMeta,
                })
                .from(withdrawals)
                .where(whereClause)
                .orderBy(desc(withdrawals.requestedAt))
                .limit(options.limit)
                .offset(options.offset),
            this.db
                .select({
                    count: sql<string>`COUNT(*)`,
                })
                .from(withdrawals)
                .where(whereClause),
        ]);

        const items = records.map((record) => this.mapWithdrawalRecord(record));

        return {
            items,
            total: Number(totalResult[0]?.count ?? 0),
        };
    }

    private mapWithdrawalRecord(
        record: WithdrawalQueryResult,
    ): WorkerEarningsRecordItem {
        const amountNumber = Number(record.amount ?? 0) || 0;

        return {
            id: record.id,
            flowType: 'withdrawal',
            transactionType: 'withdrawal',
            amount: -amountNumber,
            currency: record.currency ?? 'CNY',
            description: record.remark ?? '余额提现',
            referenceId: record.payoutReferenceId ?? null,
            occurredAt: record.requestedAt ?? new Date(),
            withdrawal: {
                id: record.id,
                status: (record.status as WithdrawalStatus) ?? 'pending',
                method: (record.method as PaymentMethod) ?? 'alipay',
                remark: record.remark ?? null,
                reviewNote: record.reviewNote ?? null,
                failureReason: record.failureReason ?? null,
                providerState: record.providerState ?? null,
                providerAppId: record.providerAppId ?? null,
                providerBillNo: record.providerBillNo ?? null,
                providerPackageInfo: record.providerPackageInfo ?? null,
                providerMeta: record.providerMeta ?? null,
                requestedAt: record.requestedAt ?? new Date(),
                reviewedAt: record.reviewedAt ?? null,
                processedAt: record.processedAt ?? null,
            } as WorkerEarningsRecordItem['withdrawal'],
        };
    }
}
