import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DB } from "src/common/database/database.provider";
import { DbType } from "src/common/database/db";
import {
	financialTransactions,
	payments,
	userBalances,
	withdrawals,
} from "src/common/database/schema";

type PaymentInsert = typeof payments.$inferInsert;
type PaymentMethod = (typeof payments.paymentMethod.enumValues)[number];

type WithdrawalInsert = typeof withdrawals.$inferInsert;
type FinancialTransactionInsert = typeof financialTransactions.$inferInsert;

type Executor = DbType;

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
				and(eq(payments.orderId, orderId), eq(payments.paymentMethod, method)),
			)
			.orderBy(desc(payments.id))
			.limit(1);

		return record ?? null;
	}

	async updatePaymentById(
		id: string,
		data: Partial<Omit<PaymentInsert, "id" | "orderId">>,
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
		data: Partial<Omit<typeof userBalances.$inferInsert, "id" | "userId">>,
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

	async updateWithdrawalById(
		id: string,
		data: Partial<Omit<WithdrawalInsert, "id" | "userId">>,
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
}
