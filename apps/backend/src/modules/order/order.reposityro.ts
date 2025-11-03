import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { CreateOrder } from '@repo/types';
import {
    and,
    asc,
    between,
    desc,
    eq,
    getTableColumns,
    gte,
    lte,
    type SQL,
    sql,
} from 'drizzle-orm';
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
import { services } from 'src/common/database/schema/server';
import {
    servicePersonnel,
    servicePersonnelPricing,
} from 'src/common/database/schema/shops-service';

export type OrderStatus = (typeof orders.status.enumValues)[number];

@Injectable()
export class OrderRepository {
    @Inject(DB)
    private readonly db: DbType;

    // 定义合法的状态转换
    // key: 当前状态, value: 可转换到的下一个状态数组
    private readonly validStatusTransitions: Record<
        OrderStatus,
        OrderStatus[]
    > = {
        pending_payment: ['paid', 'cancelled'],
        paid: ['in_progress', 'cancelled'],
        in_progress: ['completed'], // 服务中状态不能再取消，只能完成
        completed: ['refunded'], // 假设完成的订单可以退款
        cancelled: [], // 取消的订单不能再改变状态
        refunded: [], // 退款的订单不能再改变状态
    };

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
            customerId: orderColumnCustomerId,
            serviceId: orderColumnServiceId,
            addressId: orderColumnAddressId,
            originalAmount: orderColumnOriginalAmount,
            discountAmount: orderColumnDiscountAmount,
            currency: orderColumnCurrency,
            couponCode: orderColumnCouponCode,
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
                    serviceName: services.name,
                    serviceDescription: services.description,
                    servicePersonnelUserId: orderAssignments.servicePersonnelId,
                    userName: users.name,
                    userImage: users.image,
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
                    users,
                    eq(orderAssignments.servicePersonnelId, users.id),
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
            serviceName: row.serviceName || '',
            servicePersonnelName: row.userName || '服务人员',
            serviceSpecifications:
                row.serviceSpecifications || row.serviceDescription || '',
            servicePersonnelImage: row.userImage || '',
        }));

        return {
            items: data,
            total: totalCount,
            page,
            limit,
        };
    }

    /**
     * 根据订单ID获取单个订单信息
     * @param id 订单ID
     * @returns 订单详情对象，如果未找到则返回null
     */
    async getOrderById(id: string) {
        const orderColumns = getTableColumns(orders);
        const { ...serviceColumns } = getTableColumns(services);
        const { geom: addressGeom, ...addressColumns } =
            getTableColumns(userAddresses);
        const assignmentColumns = getTableColumns(orderAssignments);
        const { geom: servicePersonnelGeom, ...servicePersonnelColumns } =
            getTableColumns(servicePersonnel);

        const [orderRow] = await this.db
            .select({
                order: orderColumns,
                service: serviceColumns,
                address: addressColumns,
                assignment: assignmentColumns,
                servicePersonnel: servicePersonnelColumns,
                userName: users.name,
                userImage: users.image,
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
            .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
            .leftJoin(orderAssignments, eq(orders.id, orderAssignments.orderId))
            .leftJoin(
                servicePersonnel,
                eq(
                    orderAssignments.servicePersonnelId,
                    servicePersonnel.userId,
                ),
            )
            .leftJoin(users, eq(orderAssignments.servicePersonnelId, users.id))
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

        const assignmentWithPersonnel = orderRow.assignment
            ? {
                  ...orderRow.assignment,
                  servicePersonnel: orderRow.servicePersonnel || null,
              }
            : null;

        return {
            ...orderRow.order,
            service: orderRow.service || null,
            address: orderRow.address || null,
            assignment: assignmentWithPersonnel,
            payments: orderRow.paymentsJson || [],
            couponUsageRecords: orderRow.couponsJson || [],
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
    } /**
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
        const updatedOrders = await this.db
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
        cancelledById: string,
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

        // 2. 验证状态转换是否合法 (只能从 pending_payment 或 paid 状态转换到 cancelled)
        if (!this.isValidStatusTransition(currentStatus, 'cancelled')) {
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
                cancelledBy: cancelledById,
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
     * @deprecated 在MVP阶段，所有订单都通过createOrderWithDesignatedPersonnel创建
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
        discountAmount: string;
        designatedPersonnelId: string;
        price: string;
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                `创建指定服务人员订单时发生错误: ${error.message}`,
            );
        }
    }
}
