import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, sql, type SQL } from "drizzle-orm";

import { DB } from "src/common/database/database.provider";
import type { DbType } from "src/common/database/db";
import {
	orderCheckins,
	type OrderCheckinStatus,
} from "src/common/database/schema/order-checkins";
import { orders } from "src/common/database/schema/orders";
import { userAddresses } from "src/common/database/schema/addresses";

export type OrderCheckinRecord = typeof orderCheckins.$inferSelect;
export type OrderCheckinInsert = {
	orderId: string;
	tokenHash: string;
	expiresAt: Date;
};

const STATUS_PENDING: OrderCheckinStatus = "pending";
const STATUS_REVOKED: OrderCheckinStatus = "revoked";

@Injectable()
export class OrderCheckinRepository {
	@Inject(DB)
	private readonly db: DbType;

	private resolveDb(executor?: DbType) {
		return executor ?? this.db;
	}

	async findLatestPending(
		orderId: string,
		now: Date,
	): Promise<OrderCheckinRecord | undefined> {
		return await this.db.query.orderCheckins.findFirst({
			where: and(
				eq(orderCheckins.orderId, orderId),
				eq(orderCheckins.status, STATUS_PENDING),
				gt(orderCheckins.expiresAt, now),
			),
			orderBy: (checkins, { asc }) => asc(checkins.expiresAt),
		});
	}

	async create(
		data: OrderCheckinInsert,
		executor?: DbType,
	): Promise<OrderCheckinRecord> {
		const db = this.resolveDb(executor);
		const [record] = await db
			.insert(orderCheckins)
			.values({
				orderId: data.orderId,
				tokenHash: data.tokenHash,
				expiresAt: data.expiresAt,
			})
			.returning();

		return record;
	}

	async revokePending(orderId: string, executor?: DbType): Promise<number> {
		const db = this.resolveDb(executor);
		const result = await db
			.update(orderCheckins)
			.set({
				status: STATUS_REVOKED,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(orderCheckins.orderId, orderId),
					eq(orderCheckins.status, STATUS_PENDING),
				),
			);

		return Number(result.rowCount ?? 0);
	}

	async findByTokenHash(
		tokenHash: string,
	): Promise<OrderCheckinRecord | undefined> {
		return await this.db.query.orderCheckins.findFirst({
			where: eq(orderCheckins.tokenHash, tokenHash),
			orderBy: (checkins, { desc }) => desc(checkins.createdAt),
		});
	}

	async updateStatus(
		id: string,
		status: OrderCheckinStatus,
		patch: {
			verifiedAt?: Date | null;
			verifiedBy?: string | null;
			verifiedGeom?: SQL | null;
		},
		executor?: DbType,
	): Promise<OrderCheckinRecord | null> {
		const db = this.resolveDb(executor);
		const [record] = await db
			.update(orderCheckins)
			.set({
				status,
				verifiedAt: patch.verifiedAt ?? null,
				verifiedBy: patch.verifiedBy ?? null,
				verifiedGeom: patch.verifiedGeom ?? null,
				updatedAt: new Date(),
			})
			.where(eq(orderCheckins.id, id))
			.returning();

		return record ?? null;
	}

	async isWithinRange(
		orderId: string,
		userPoint: SQL,
		maxDistanceDegrees: number,
	): Promise<boolean> {
		const [row] = await this.db
			.select({
				within: sql<boolean>`ST_DWithin(${userAddresses.geom}, ${userPoint}, ${maxDistanceDegrees})`,
			})
			.from(orders)
			.innerJoin(userAddresses, eq(orders.addressId, userAddresses.id))
			.where(eq(orders.id, orderId))
			.limit(1);

		return Boolean(row?.within);
	}
}
