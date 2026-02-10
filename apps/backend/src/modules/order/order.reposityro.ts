import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
    and,
    asc,
    between,
    desc,
    eq,
    getTableColumns,
    gte,
    isNull,
    inArray,
    lte,
    type SQL,
    sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { userAddresses } from 'src/common/database/schema/addresses';
import { users } from 'src/common/database/schema/auth-user';
import { couponUsageRecords } from 'src/common/database/schema/coupons';
import {
    orderAssignments,
    orders,
    payments,
} from 'src/common/database/schema/orders';
import {
    services,
    servicePersonnelSkills,
} from 'src/common/database/schema/server';
import {
    servicePersonnel,
    servicePersonnelPricing,
} from 'src/common/database/schema/shops-service';
import { reviews } from 'src/common/database/schema/reviews-social';
import { files } from 'src/common/database/schema/file';

export type OrderStatus = (typeof orders.status.enumValues)[number];

@Injectable()
export class OrderRepository {
    @Inject(DB)
    private readonly db: DbType;

    async transaction<T>(callback: (tx: DbType) => Promise<T>): Promise<T> {
        return await this.db.transaction(callback);
    }

    // 定义合法的状态转换
    // key: 当前状态, value: 可转换到的下一个状态数组
    private readonly validStatusTransitions: Record<
        OrderStatus,
        OrderStatus[]
    > = {
        pending_payment: [
            'pending_acceptance',
            'paid',
            'cancelled',
            'payment_timeout',
        ],
        pending_acceptance: ['paid', 'cancelled', 'staff_rejected'],
        staff_rejected: ['pending_acceptance', 'cancelled'],
        paid: ['in_progress', 'cancelled', 'staff_rejected'],
        in_progress: ['completed'], // 服务中状态不能再取消，只能完成
        completed: ['refunded'], // 假设完成的订单可以退款
        cancelled: [], // 取消的订单不能再改变状态
        payment_timeout: [], // 支付超时视为终态
        refunded: [], // 退款的订单不能再改变状态
    };

    private readonly cancellableStatuses: OrderStatus[] = [
        'pending_payment',
        'pending_acceptance',
        'paid',
        'staff_rejected',
    ];

    private buildPaginationMeta(total: number, page: number, limit: number) {
        const safePage = page > 0 ? page : 1;
        const safeLimit = limit > 0 ? limit : 10;
        const totalPages = safeLimit === 0 ? 0 : Math.ceil(total / safeLimit);

        return {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages,
            hasNext: safePage < totalPages,
            hasPrev: safePage > 1 && totalPages > 0,
        };
    }

    /**
     * 获取客户的订单列表（简化格式）
     */
    async getOrdersByCustomerId({
        page = 1,
        limit = 10,
        status,
        customerId,
        startTime,
        endTime,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    }: {
        page?: number;
        limit?: number;
        status?: OrderStatus;
        customerId: string;
        startTime?: Date;
        endTime?: Date;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }) {
        const {
            customerId: _orderColumnCustomerId,
            serviceId: _orderColumnServiceId,
            addressId: _orderColumnAddressId,
            originalAmount: _orderColumnOriginalAmount,
            discountAmount: _orderColumnDiscountAmount,
            currency: _orderColumnCurrency,
            couponCode: _orderColumnCouponCode,
            ...orderColumns
        } = getTableColumns(orders);

        if (!(sortBy in orderColumns)) {
            throw new BadRequestException('请输入有效的排序字段');
        }

        // 构建查询条件
        const conditions: SQL[] = [eq(orders.customerId, customerId)];

        if (status) {
            conditions.push(eq(orders.status, status));
        }

        if (startTime && !endTime) {
            conditions.push(gte(orders.appointmentTime, startTime));
        } else if (endTime && !startTime) {
            conditions.push(lte(orders.appointmentTime, endTime));
        } else if (startTime && endTime) {
            conditions.push(
                between(orders.appointmentTime, startTime, endTime),
            );
        }

        const sortColumn = orderColumns[sortBy as keyof typeof orderColumns];
        const orderByClause =
            sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

        // 查询简化的订单列表数据
        const [rows, totalCount] = await Promise.all([
            this.db
                .select({
                    orderId: orders.id,
                    status: orders.status,
                    totalAmount: orders.totalAmount,
                    appointmentTime: orders.appointmentTime,
                    paymentExpiresAt: orders.paymentExpiresAt,
                    serviceName: services.name,
                    serviceDescription: services.description,
                    servicePersonnelUserId: orderAssignments.servicePersonnelId,
                    servicePersonnelName: servicePersonnel.name,
                    servicePersonnelAvatar: servicePersonnel.avatar,
                    // 使用子查询获取服务规格（从 servicePersonnelPricing 表）
                    serviceSpecifications: sql<string>`(
						SELECT COALESCE(spp.name, '')
						FROM ${servicePersonnelPricing} spp
						WHERE spp.service_id = ${orders.serviceId}
							AND spp.user_id = ${orderAssignments.servicePersonnelId}
							AND spp.is_active = true
						LIMIT 1
					)`,
                })
                .from(orders)
                .leftJoin(services, eq(orders.serviceId, services.id))
                .leftJoin(
                    orderAssignments,
                    eq(orders.id, orderAssignments.orderId),
                )
                .leftJoin(
                    servicePersonnel,
                    eq(
                        orderAssignments.servicePersonnelId,
                        servicePersonnel.userId,
                    ),
                )
                .where(and(...conditions))
                .limit(limit)
                .offset((page - 1) * limit)
                .orderBy(orderByClause),
            this.db.$count(orders, and(...conditions)),
        ]);

        // 转换为简化格式
        const data = rows.map((row) => ({
            id: row.orderId,
            status: row.status,
            totalAmount: row.totalAmount,
            appointmentTime: row.appointmentTime,
            paymentExpiresAt: row.paymentExpiresAt,
            serviceName: row.serviceName || '',
            servicePersonnelName: row.servicePersonnelName || '服务人员',
            serviceSpecifications:
                row.serviceSpecifications || row.serviceDescription || '',
            servicePersonnelImage: row.servicePersonnelAvatar || '',
        }));

        const meta = this.buildPaginationMeta(totalCount, page, limit);

        return {
            items: data,
            meta,
        };
    }

    /**
     * 获取用户端订单列表页卡片数据
     *
     * 专用接口：用于 `GET /api/order/cards`。
     * 注意：只返回订单列表页需要的字段，不要混入详情字段。
     */
    async getOrderCardsByCustomerId({
        customerId,
        page = 1,
        limit = 10,
        statuses,
        needsReviewOnly,
    }: {
        customerId: string;
        page?: number;
        limit?: number;
        statuses?: OrderStatus[];
        needsReviewOnly?: boolean;
    }) {
        const notExistsReviewSql = sql<boolean>`NOT EXISTS(
            select 1
            from ${reviews}
            where ${reviews.orderId} = ${orders.id}
              and ${reviews.reviewerId} = ${orders.customerId}
        )`;

        const conditions: SQL[] = [eq(orders.customerId, customerId)];

        if (statuses?.length) {
            conditions.push(inArray(orders.status, statuses));
        }

        // needs_review tab: completed 且当前用户未评价
        if (needsReviewOnly) {
            conditions.push(eq(orders.status, 'completed'));
            conditions.push(notExistsReviewSql);
        }

        const whereClause = and(...conditions);

        const [rows, totalResult] = await Promise.all([
            this.db
                .select({
                    id: orders.id,
                    status: orders.status,
                    serviceName: services.name,
                    serviceId: orders.serviceId,
                    servicePersonnelId: orderAssignments.servicePersonnelId,
                    workerName: servicePersonnel.name,
                    workerAvatar: servicePersonnel.avatar,
                    workerAvatarBucketName: files.bucketName,
                    workerAvatarObjectPath: files.objectPath,
                    workerAvatarBlurhash: files.blurhash,
                    appointmentTime: orders.appointmentTime,
                    totalAmount: orders.totalAmount,
                    paymentExpiresAt: orders.paymentExpiresAt,
                    // 仅 completed 才需要评价；其他状态直接 false。
                    needsReview: sql<boolean>`case when ${orders.status} = 'completed'
                        then ${notExistsReviewSql}
                        else false
                    end`,
                })
                .from(orders)
                .leftJoin(services, eq(orders.serviceId, services.id))
                .leftJoin(
                    orderAssignments,
                    eq(orders.id, orderAssignments.orderId),
                )
                .leftJoin(
                    servicePersonnel,
                    eq(
                        orderAssignments.servicePersonnelId,
                        servicePersonnel.userId,
                    ),
                )
                .leftJoin(files, eq(files.fileHash, servicePersonnel.avatar))
                .where(whereClause)
                .orderBy(desc(orders.createdAt))
                .limit(limit)
                .offset((page - 1) * limit),
            this.db
                .select({ count: sql<number>`count(*)` })
                .from(orders)
                .where(whereClause),
        ]);

        const totalCount = totalResult[0]?.count ?? 0;
        const meta = this.buildPaginationMeta(totalCount, page, limit);

        const items = rows.map((row) => {
            return {
                id: row.id,
                status: row.status,
                // serviceName 理论上不会为 null（FK restrict），但 join 仍做兜底。
                serviceName: row.serviceName ?? row.serviceId,
                serviceId: row.serviceId,
                servicePersonnelId: row.servicePersonnelId ?? null,
                workerName: row.workerName ?? null,
                workerAvatar: row.workerAvatar ?? null,
                workerAvatarBucketName: row.workerAvatarBucketName ?? null,
                workerAvatarObjectPath: row.workerAvatarObjectPath ?? null,
                workerAvatarBlurhash: row.workerAvatarBlurhash ?? null,
                appointmentTime: row.appointmentTime,
                totalAmount: Number(row.totalAmount ?? 0),
                // 仅 pending_payment 才需要倒计时；其他状态一律返回 null，减少前端判断。
                paymentExpiresAt:
                    row.status === 'pending_payment'
                        ? row.paymentExpiresAt
                        : null,
                needsReview: row.needsReview,
            };
        });

        return {
            items,
            meta,
        };
    }

    async getOrdersByStaffId({
        page = 1,
        limit = 10,
        status,
        servicePersonnelId,
        startTime,
        endTime,
        onlyAccepted,
    }: {
        page?: number;
        limit?: number;
        status?: OrderStatus;
        servicePersonnelId: string;
        startTime?: Date;
        endTime?: Date;
        onlyAccepted?: boolean;
    }) {
        const conditions: SQL[] = [
            eq(orderAssignments.servicePersonnelId, servicePersonnelId),
        ];

        if (status) {
            conditions.push(eq(orders.status, status));
        }

        if (onlyAccepted) {
            conditions.push(eq(orderAssignments.decisionStatus, 'accepted'));
        }

        if (startTime && !endTime) {
            conditions.push(gte(orders.appointmentTime, startTime));
        } else if (endTime && !startTime) {
            conditions.push(lte(orders.appointmentTime, endTime));
        } else if (startTime && endTime) {
            conditions.push(
                between(orders.appointmentTime, startTime, endTime),
            );
        }

        const whereClause = and(...conditions);

        const [rows, totalResult] = await Promise.all([
            this.db
                .select({
                    orderId: orders.id,
                    status: orders.status,
                    appointmentTime: orders.appointmentTime,
                    totalAmount: orders.totalAmount,
                    serviceName: services.name,
                    serviceSpecification: servicePersonnelPricing.name,
                    customerName: users.name,
                    customerPhone: users.phoneNumber,
                    customerAvatar: users.image,
                    address: userAddresses.detailedAddress,
                    remark: orders.remark,
                    acceptedAt: orderAssignments.acceptedAt,
                    decisionStatus: orderAssignments.decisionStatus,
                    rejectReason: orderAssignments.rejectReason,
                    rejectedAt: orderAssignments.rejectedAt,
                    serviceStartedAt: orders.serviceStartedAt,
                    serviceCompletedAt: orders.serviceCompletedAt,
                })
                .from(orders)
                .innerJoin(
                    orderAssignments,
                    eq(orderAssignments.orderId, orders.id),
                )
                .leftJoin(services, eq(orders.serviceId, services.id))
                .leftJoin(
                    servicePersonnelPricing,
                    eq(orders.specificationId, servicePersonnelPricing.id),
                )
                .leftJoin(users, eq(orders.customerId, users.id))
                .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
                .where(whereClause)
                .orderBy(desc(orders.appointmentTime))
                .limit(limit)
                .offset((page - 1) * limit),
            this.db
                .select({ count: sql<number>`count(*)` })
                .from(orders)
                .innerJoin(
                    orderAssignments,
                    eq(orderAssignments.orderId, orders.id),
                )
                .where(whereClause),
        ]);

        const totalCount = totalResult[0]?.count ?? 0;
        const meta = this.buildPaginationMeta(totalCount, page, limit);

        const items = rows.map((row) => ({
            id: row.orderId,
            status: row.status,
            appointmentTime: row.appointmentTime,
            totalAmount: Number(row.totalAmount ?? 0),
            serviceName: row.serviceName ?? '',
            serviceSpecification: row.serviceSpecification ?? null,
            customerName: row.customerName ?? null,
            customerPhone: row.customerPhone ?? null,
            customerAvatar: row.customerAvatar ?? null,
            address: row.address ?? null,
            remark: row.remark ?? null,
            acceptedAt: row.acceptedAt ?? null,
            decisionStatus: row.decisionStatus ?? 'pending',
            rejectReason: row.rejectReason ?? null,
            rejectedAt: row.rejectedAt ?? null,
            serviceStartedAt: row.serviceStartedAt ?? null,
            serviceCompletedAt: row.serviceCompletedAt ?? null,
        }));

        return {
            items,
            meta,
        };
    }

    async countOrdersByStaff({
        servicePersonnelId,
        status,
    }: {
        servicePersonnelId: string;
        status?: OrderStatus;
    }) {
        const conditions: SQL[] = [
            eq(orderAssignments.servicePersonnelId, servicePersonnelId),
        ];

        if (status) {
            conditions.push(eq(orders.status, status));
        }

        const whereClause = and(...conditions);

        const [row] = await this.db
            .select({
                count: sql<number>`count(*)`,
            })
            .from(orders)
            .innerJoin(
                orderAssignments,
                eq(orderAssignments.orderId, orders.id),
            )
            .where(whereClause);

        return row?.count ?? 0;
    }

    /**
     * 根据订单ID获取单个订单信息
     * @param id 订单ID
     * @returns 订单详情对象，如果未找到则返回null
     */
    async getOrderById(id: string) {
        const orderColumns = getTableColumns(orders);
        const { ...serviceColumns } = getTableColumns(services);
        const { geom: _addressGeom, ...addressColumns } =
            getTableColumns(userAddresses);
        const assignmentColumns = getTableColumns(orderAssignments);
        const { geom: servicePersonnelGeom, ...servicePersonnelColumns } =
            getTableColumns(servicePersonnel);

        const notExistsReviewSql = sql<boolean>`NOT EXISTS(
            select 1
            from ${reviews}
            where ${reviews.orderId} = ${orders.id}
              and ${reviews.reviewerId} = ${orders.customerId}
        )`;

        const serviceImageFile = alias(files, 'order_detail_service_image');
        const personnelAvatarFile = alias(
            files,
            'order_detail_personnel_avatar',
        );

        const [orderRow] = await this.db
            .select({
                order: orderColumns,
                service: serviceColumns,
                address: addressColumns,
                assignment: assignmentColumns,
                servicePersonnel: {
                    ...servicePersonnelColumns,
                    geom: servicePersonnelGeom,
                },
                specificationName: servicePersonnelPricing.name,
                estimatedDurationMinutes:
                    servicePersonnelPricing.estimatedDurationMinutes,
                needsReview: sql<boolean>`case when ${orders.status} = 'completed'
                    then ${notExistsReviewSql}
                    else false
                end`,
                serviceImageBucketName: serviceImageFile.bucketName,
                serviceImageObjectPath: serviceImageFile.objectPath,
                serviceImageBlurhash: serviceImageFile.blurhash,
                personnelAvatarBucketName: personnelAvatarFile.bucketName,
                personnelAvatarObjectPath: personnelAvatarFile.objectPath,
                personnelAvatarBlurhash: personnelAvatarFile.blurhash,
                paymentsJson: sql<any>`(
                        SELECT COALESCE(json_agg(row_to_json(p.*)), '[]'::json)
                        FROM ${payments} p
                        WHERE p.order_id = ${orders.id}
                    )`.mapWith((val) => {
                    if (!val || val === '[]') return [];
                    if (Array.isArray(val)) return val;
                    try {
                        return JSON.parse(String(val));
                    } catch {
                        return [];
                    }
                }),
                // 使用子查询聚合 couponUsageRecords
                couponsJson: sql<any>`(
                        SELECT COALESCE(json_agg(row_to_json(c.*)), '[]'::json)
                        FROM ${couponUsageRecords} c
                        WHERE c.order_id = ${orders.id}
                    )`.mapWith((val) => {
                    if (!val || val === '[]') return [];
                    if (Array.isArray(val)) return val;
                    try {
                        return JSON.parse(String(val));
                    } catch {
                        return [];
                    }
                }),
                serviceSpecifications: sql<string>`(
						SELECT COALESCE(spp.name, '')
						FROM ${servicePersonnelPricing} spp
						WHERE spp.service_id = ${orders.serviceId}
							AND spp.user_id = ${orderAssignments.servicePersonnelId}
							AND spp.is_active = true
						LIMIT 1
					)`,
            })
            .from(orders)
            .leftJoin(services, eq(orders.serviceId, services.id))
            .leftJoin(
                serviceImageFile,
                eq(serviceImageFile.id, services.imageFileId),
            )
            .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
            .leftJoin(orderAssignments, eq(orders.id, orderAssignments.orderId))
            .leftJoin(
                servicePersonnel,
                eq(
                    orderAssignments.servicePersonnelId,
                    servicePersonnel.userId,
                ),
            )
            .leftJoin(
                personnelAvatarFile,
                eq(personnelAvatarFile.fileHash, servicePersonnel.avatar),
            )
            .leftJoin(
                servicePersonnelPricing,
                eq(orders.specificationId, servicePersonnelPricing.id),
            )
            .where(eq(orders.id, id))
            .limit(1);

        if (!orderRow) {
            return null;
        }

        // const paymentsRows = await this.db
        // 	.select(getTableColumns(payments))
        // 	.from(payments)
        // 	.where(eq(payments.orderId, id));

        // const couponRows = await this.db
        // 	.select(getTableColumns(couponUsageRecords))
        // 	.from(couponUsageRecords)
        // 	.where(eq(couponUsageRecords.orderId, id));

        const personnelName = orderRow.servicePersonnel?.name?.trim();
        const personnelAvatar = orderRow.servicePersonnel?.avatar?.trim();

        const assignmentWithPersonnel = orderRow.assignment
            ? {
                  ...orderRow.assignment,
                  servicePersonnel: orderRow.servicePersonnel
                      ? {
                            ...orderRow.servicePersonnel,
                            avatarUrl: personnelAvatar || undefined,
                            image: personnelAvatar || undefined,
                            userName: personnelName || undefined,
                        }
                      : null,
              }
            : null;

        return {
            ...orderRow.order,
            service: orderRow.service || null,
            address: orderRow.address || null,
            assignment: assignmentWithPersonnel,
            payments: orderRow.paymentsJson || [],
            couponUsageRecords: orderRow.couponsJson || [],
            specificationName: orderRow.specificationName ?? null,
            estimatedDurationMinutes: orderRow.estimatedDurationMinutes ?? null,
            needsReview: orderRow.needsReview ?? false,
            serviceImageBucketName: orderRow.serviceImageBucketName ?? null,
            serviceImageObjectPath: orderRow.serviceImageObjectPath ?? null,
            serviceImageBlurhash: orderRow.serviceImageBlurhash ?? null,
            personnelAvatarBucketName:
                orderRow.personnelAvatarBucketName ?? null,
            personnelAvatarObjectPath:
                orderRow.personnelAvatarObjectPath ?? null,
            personnelAvatarBlurhash: orderRow.personnelAvatarBlurhash ?? null,
        };
    }

    /**
     * 获取指定服务人员在特定时间范围内的订单
     * @param personnelId 服务人员ID
     * @param startTime 时间范围开始时间
     * @param endTime 时间范围结束时间
     * @returns 订单列表
     */
    async getOrdersByPersonnelAndTimeRange(
        personnelId: string,
        startTime: Date,
        endTime: Date,
    ) {
        // 使用原始查询来连接订单和分配表，并包含服务规格信息
        const results = await this.db
            .select({
                order: orders,
                service: services,
                assignment: orderAssignments,
                specification: servicePersonnelPricing,
            })
            .from(orders)
            .leftJoin(services, eq(orders.serviceId, services.id))
            .innerJoin(
                orderAssignments,
                eq(orders.id, orderAssignments.orderId),
            )
            .leftJoin(
                servicePersonnelPricing,
                eq(orders.specificationId, servicePersonnelPricing.id),
            )
            .where(
                and(
                    eq(orderAssignments.servicePersonnelId, personnelId),
                    lte(orders.appointmentTime, endTime),
                    gte(orders.appointmentTime, startTime),
                ),
            );

        // 转换结果格式以匹配期望的类型
        return results.map((result) => ({
            ...result.order,
            service: result.service,
            assignment: result.assignment,
            specification: result.specification,
        }));
    }

    /**
     * 获取服务规格信息
     * @param specificationId 服务规格ID
     * @returns 服务规格信息
     */
    async getServiceSpecification(specificationId: string) {
        const [specification] = await this.db
            .select()
            .from(servicePersonnelPricing)
            .where(eq(servicePersonnelPricing.id, specificationId))
            .limit(1);

        return specification || null;
    }

    /**
     * 获取服务人员的已占用时间段
     * @param personnelId 服务人员ID
     * @param startDate 查询开始日期（可选，默认为当前时间）
     * @param endDate 查询结束日期（可选，默认为30天后）
     * @returns 已占用的时间段列表
     */
    async getPersonnelOccupiedTimeSlots(
        personnelId: string,
        startDate?: Date,
        endDate?: Date,
    ) {
        const start = startDate || new Date();
        // 默认查询15天内
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        const end = endDate || new Date(start.getTime() + fifteenDaysMs);

        // 查询该服务人员在指定时间范围内的所有有效订单
        const occupiedOrders = await this.db
            .select({
                orderId: orders.id,
                appointmentTime: orders.appointmentTime,
                status: orders.status,
                estimatedDurationMinutes:
                    servicePersonnelPricing.estimatedDurationMinutes,
            })
            .from(orders)
            .innerJoin(
                orderAssignments,
                eq(orders.id, orderAssignments.orderId),
            )
            .leftJoin(
                servicePersonnelPricing,
                eq(orders.specificationId, servicePersonnelPricing.id),
            )
            .where(
                and(
                    eq(orderAssignments.servicePersonnelId, personnelId),
                    gte(orders.appointmentTime, start),
                    lte(orders.appointmentTime, end),
                    // 只查询未取消和未退款的订单
                    sql`${orders.status} NOT IN ('cancelled', 'payment_timeout', 'refunded')`,
                ),
            )
            .orderBy(asc(orders.appointmentTime));

        // 转换为时间段格式
        return occupiedOrders.map((order) => {
            const startTime = new Date(order.appointmentTime);
            const endTime = new Date(startTime);
            endTime.setMinutes(
                endTime.getMinutes() + (order.estimatedDurationMinutes || 60), // 默认60分钟
            );

            return {
                orderId: order.orderId,
                startTime,
                endTime,
                status: order.status,
            };
        });
    }

    /**
     * 更新订单状态
     * @param id 订单ID
     * @param newStatus 新的订单状态
     * @returns 更新后的订单信息
     */
    async updateOrderStatus(
        id: string,
        newStatus: OrderStatus,
        executor?: DbType,
    ) {
        const db = executor ?? this.db;

        // 1. 获取当前订单状态
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, id),
            columns: { status: true },
        });

        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        const currentStatus = order.status;

        // 2. 验证状态转换是否合法
        if (!this.isValidStatusTransition(currentStatus, newStatus)) {
            throw new BadRequestException(
                `将状态${currentStatus} 变更为 ${newStatus} 是非法的`,
            );
        }

        // 3. 更新订单状态
        const updatedOrders = await db
            .update(orders)
            .set({
                status: newStatus,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, id))
            .returning();

        // 4. 验证更新结果
        if (updatedOrders.length === 0) {
            throw new BadRequestException('订单状态更新失败');
        }

        return updatedOrders[0];
    }

    /**
     * 扫码核验后将订单从 paid 原子切换到 in_progress，并写入 serviceStartedAt。
     *
     * 幂等：仅当 status='paid' 且 service_started_at 为空时才会写入。
     */
    async startService(
        orderId: string,
        startedAt: Date,
        executor?: DbType,
    ): Promise<boolean> {
        const db = executor ?? this.db;
        const [updated] = await db
            .update(orders)
            .set({
                status: 'in_progress',
                serviceStartedAt: startedAt,
                updatedAt: startedAt,
            })
            .where(
                and(
                    eq(orders.id, orderId),
                    eq(orders.status, 'paid'),
                    isNull(orders.serviceStartedAt),
                ),
            )
            .returning({ id: orders.id });

        return Boolean(updated?.id);
    }

    /**
     * 服务人员改期：仅更新 orders.appointment_time。
     */
    async updateAppointmentTime(
        orderId: string,
        appointmentTime: Date,
        allowedStatuses: OrderStatus[],
        executor?: DbType,
    ) {
        const db = executor ?? this.db;
        const [updated] = await db
            .update(orders)
            .set({
                appointmentTime,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(orders.id, orderId),
                    inArray(orders.status, allowedStatuses),
                ),
            )
            .returning();

        return updated ?? null;
    }

    /**
     * 完成订单并递增 serviced_count（原子 + 幂等）
     *
     * 幂等保证：仅允许从 in_progress -> completed，重复调用不会重复计数。
     */
    async completeOrderAndIncrementServicedCount(orderId: string) {
        return await this.db.transaction(async (tx) => {
            const now = new Date();

            const [updated] = await tx
                .update(orders)
                .set({
                    status: 'completed',
                    updatedAt: now,
                    serviceCompletedAt: now,
                })
                .where(
                    and(
                        eq(orders.id, orderId),
                        eq(orders.status, 'in_progress'),
                    ),
                )
                .returning();

            if (!updated) {
                throw new BadRequestException('订单必须处于服务中状态才能完成');
            }

            const assignment = await tx.query.orderAssignments.findFirst({
                where: eq(orderAssignments.orderId, orderId),
                columns: {
                    servicePersonnelId: true,
                },
            });

            if (!assignment?.servicePersonnelId) {
                throw new BadRequestException('订单未找到分配的服务人员');
            }

            await tx
                .update(servicePersonnelSkills)
                .set({
                    servicedCount: sql`${servicePersonnelSkills.servicedCount} + 1`,
                })
                .where(
                    and(
                        eq(
                            servicePersonnelSkills.userId,
                            assignment.servicePersonnelId,
                        ),
                        eq(servicePersonnelSkills.serviceId, updated.serviceId),
                    ),
                );

            return updated;
        });
    }

    /**
     * 标记订单为支付超时
     */
    async markOrderPaymentTimeout(
        id: string,
        reason: string,
        executor?: DbType,
    ) {
        const db = executor ?? this.db;
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, id),
            columns: { status: true },
        });

        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        if (!this.isValidStatusTransition(order.status, 'payment_timeout')) {
            throw new BadRequestException('当前状态无法标记为支付超时');
        }

        const updatedOrders = await db
            .update(orders)
            .set({
                status: 'payment_timeout',
                cancelReason: reason,
                cancelledBy: null,
                cancelledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(orders.id, id))
            .returning();

        if (updatedOrders.length === 0) {
            throw new BadRequestException('支付超时标记失败');
        }

        return updatedOrders[0];
    }

    /**
     * 取消订单
     * @param id 订单ID
     * @param reason 取消原因
     * @param cancelledById 取消订单的用户ID
     * @param executor 可选的数据库执行器
     * @returns 取消后的订单信息
     */
    async cancelOrder(
        id: string,
        reason: string,
        cancelledById?: string | null,
        executor?: DbType,
    ) {
        const db = executor ?? this.db;

        // 1. 获取当前订单状态
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, id),
            columns: { status: true },
        });

        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        const currentStatus = order.status;

        // 2. 验证状态转换是否合法
        if (
            !this.cancellableStatuses.includes(currentStatus) ||
            !this.isValidStatusTransition(currentStatus, 'cancelled')
        ) {
            throw new BadRequestException(
                `当前状态 ${currentStatus} 无法取消订单`,
            );
        }

        // 3. 更新订单状态并设置取消信息
        const updatedOrders = await db
            .update(orders)
            .set({
                status: 'cancelled',
                cancelReason: reason,
                cancelledBy: cancelledById ?? null,
                cancelledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(orders.id, id))
            .returning();

        // 4. 验证更新结果
        if (updatedOrders.length === 0) {
            throw new BadRequestException('订单取消失败');
        }

        return updatedOrders[0];
    }

    async acceptAssignment(orderId: string, staffId: string) {
        await this.db.transaction(async (tx) => {
            const assignment = await tx.query.orderAssignments.findFirst({
                where: eq(orderAssignments.orderId, orderId),
                columns: {
                    servicePersonnelId: true,
                    decisionStatus: true,
                },
            });

            if (!assignment) {
                throw new BadRequestException('订单未找到分配记录');
            }

            if (assignment.servicePersonnelId !== staffId) {
                throw new BadRequestException('您不是该订单的服务人员');
            }

            if (assignment.decisionStatus !== 'pending') {
                throw new BadRequestException('订单接单状态已更新');
            }

            const order = await tx.query.orders.findFirst({
                where: eq(orders.id, orderId),
                columns: { status: true },
            });

            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            if (
                order.status !== 'pending_acceptance' &&
                order.status !== 'paid'
            ) {
                throw new BadRequestException('当前订单状态不可接单');
            }

            const now = new Date();
            await tx
                .update(orderAssignments)
                .set({
                    decisionStatus: 'accepted',
                    acceptedAt: now,
                    rejectReason: null,
                    rejectedAt: null,
                })
                .where(eq(orderAssignments.orderId, orderId));

            if (
                order.status === 'pending_acceptance' &&
                this.isValidStatusTransition(order.status, 'paid')
            ) {
                await tx
                    .update(orders)
                    .set({ status: 'paid', updatedAt: now })
                    .where(eq(orders.id, orderId));
            }
        });
    }

    async rejectAssignment(orderId: string, staffId: string, reason: string) {
        await this.db.transaction(async (tx) => {
            const assignment = await tx.query.orderAssignments.findFirst({
                where: eq(orderAssignments.orderId, orderId),
                columns: {
                    servicePersonnelId: true,
                    decisionStatus: true,
                },
            });

            if (!assignment) {
                throw new BadRequestException('订单未找到分配记录');
            }

            if (assignment.servicePersonnelId !== staffId) {
                throw new BadRequestException('您不是该订单的服务人员');
            }

            if (assignment.decisionStatus !== 'pending') {
                throw new BadRequestException('订单接单状态已更新');
            }

            const order = await tx.query.orders.findFirst({
                where: eq(orders.id, orderId),
                columns: { status: true },
            });

            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            if (
                order.status !== 'pending_acceptance' &&
                order.status !== 'paid'
            ) {
                throw new BadRequestException('当前订单状态不可拒绝');
            }

            const now = new Date();
            await tx
                .update(orderAssignments)
                .set({
                    decisionStatus: 'rejected',
                    rejectedAt: now,
                    rejectReason: reason,
                    acceptedAt: null,
                })
                .where(eq(orderAssignments.orderId, orderId));

            if (this.isValidStatusTransition(order.status, 'staff_rejected')) {
                await tx
                    .update(orders)
                    .set({
                        status: 'staff_rejected',
                        cancelReason: reason,
                        cancelledBy: staffId,
                        cancelledAt: now,
                        updatedAt: now,
                    })
                    .where(eq(orders.id, orderId));
            }
        });
    }

    /**
     * 验证状态转换是否合法
     * @param currentStatus 当前订单状态
     * @param newStatus 目标订单状态
     * @returns 如果转换合法返回true，否则返回false
     */
    private isValidStatusTransition(
        currentStatus: OrderStatus,
        newStatus: OrderStatus,
    ): boolean {
        // 获取当前状态允许的所有下一状态
        const allowedNextStatuses = this.validStatusTransitions[currentStatus];

        // 检查目标状态是否在允许的下一状态列表中
        return allowedNextStatuses
            ? allowedNextStatuses.includes(newStatus)
            : false;
    }

    /**
     * 创建订单
     * 在MVP阶段，所有订单都通过createOrderWithDesignatedPersonnel创建
     * @param data 订单数据
     * @returns 创建的订单信息
     */
    // async createOrder(data: CreateOrder) {
    //     // 生成订单流水号 (格式: ORD + YYYYMMDD + 8位随机字符)
    //     const now = new Date();
    //     const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    //     const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
    //     const orderSerial = `ORD${dateStr}${randomStr}`;

    //     try {
    //         const result = await this.db
    //             .insert(orders)
    //             .values({
    //                 ...data,
    //                 orderSerial,
    //                 originalAmount: data.originalAmount.toString(),
    //                 discountAmount: data.discountAmount.toString(),
    //                 totalAmount: data.totalAmount.toString(),
    //                 createdAt: now,
    //                 updatedAt: now,
    //             })
    //             .returning();

    //         if (result.length === 0) {
    //             throw new BadRequestException("订单创建失败");
    //         }

    //         return result[0];
    //     } catch (error) {
    //         throw new BadRequestException(
    //             // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    //             `创建订单时发生错误: ${error.message}`,
    //         );
    //     }
    // }

    /**
     * 创建用户指定服务人员的订单
     * @param data 创建订单所需的数据
     * @returns 创建结果，包含订单ID
     */
    async createOrderWithDesignatedPersonnel(data: {
        customerId: string;
        serviceId: string;
        addressId: string;
        specificationId: string;
        appointmentTime: Date;
        paymentExpiresAt: Date;
        discountAmount: string;
        designatedPersonnelId: string;
        price: string;
        remark?: string | null;
    }) {
        // 生成订单流水号 (格式: ORD + YYYYMMDD + 8位随机字符)
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();
        const orderSerial = `ORD${dateStr}${randomStr}`;

        try {
            const result = await this.db.transaction(async (tx) => {
                // 计算订单总金额
                const originalAmount = parseFloat(data.price);
                const discountAmount = parseFloat(data.discountAmount);
                const totalAmount = originalAmount - discountAmount;

                // 创建订单记录
                const [order] = await tx
                    .insert(orders)
                    .values({
                        orderSerial,
                        customerId: data.customerId,
                        serviceId: data.serviceId,
                        addressId: data.addressId,
                        specificationId: data.specificationId,
                        status: 'pending_payment', // 初始状态为待支付
                        originalAmount: originalAmount.toString(),
                        discountAmount: discountAmount.toString(),
                        totalAmount: totalAmount.toString(),
                        currency: 'CNY',
                        appointmentTime: data.appointmentTime,
                        paymentExpiresAt: data.paymentExpiresAt,
                        remark: data.remark ?? null,
                    })
                    .returning({ id: orders.id });

                // 验证订单是否创建成功
                if (!order || !order.id) {
                    throw new Error('订单创建失败');
                }

                // 创建订单分配记录
                const assignmentResult = await tx
                    .insert(orderAssignments)
                    .values({
                        orderId: order.id,
                        servicePersonnelId: data.designatedPersonnelId,
                        assignmentType: 'customer_designated', // 用户指定
                        assignedAt: now,
                        acceptedAt: null,
                        decisionStatus: 'pending',
                    });

                // 验证分配记录是否创建成功
                if (assignmentResult.rowCount === 0) {
                    throw new Error('订单分配记录创建失败');
                }

                // 返回订单ID
                return { orderId: order.id };
            });

            return result;
        } catch (error) {
            throw new BadRequestException(
                `创建指定服务人员订单时发生错误: ${error.message}`,
            );
        }
    }
}
