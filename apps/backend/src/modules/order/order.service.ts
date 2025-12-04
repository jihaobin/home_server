import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
    CreateDesignatedOrder,
    OrderListRequest,
    OrderStatus,
    StaffOrderListRequest,
    UserRole,
} from '@repo/types';
import {
    CACHE_SERVICE,
    type IAdvancedCacheService,
    OrderExpireRedisKeys,
} from 'src/common/cache';
import { DbType } from 'src/common/database/db';
import { extractParams, isTimeInRange } from 'src/lib/utlis';
import { PayService } from '../pay/pay.service';
import { WorkSkillService } from '../work-skill/work-skill.service';
import { OrderRepository } from './order.reposityro';

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    @Inject(OrderRepository)
    private readonly orderRepository: OrderRepository;

    @Inject(WorkSkillService)
    private readonly workSkillService: WorkSkillService;

    @Inject(forwardRef(() => PayService))
    private readonly payService: PayService;

    @Inject(ConfigService)
    private readonly configService: ConfigService;

    @Inject(CACHE_SERVICE)
    private readonly cacheService: IAdvancedCacheService;

    private readonly defaultPaymentExpireMinutes = 2;

    // 新增：安全地从 unknown 错误中提取消息，避免直接访问 any.message
    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;

        if (typeof error === 'string') return error;

        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    private calculatePaymentExpiresAt(): Date {
        const configuredMinutes = Number(
            this.configService.get('ORDER_PAYMENT_EXPIRE_MINUTES'),
        );
        const minutes =
            Number.isFinite(configuredMinutes) && configuredMinutes > 0
                ? configuredMinutes
                : this.defaultPaymentExpireMinutes;
        return new Date(Date.now() + minutes * 60 * 1000);
    }

    private async schedulePaymentExpiration(
        orderId: string,
        paymentExpiresAt: Date,
    ) {
        try {
            await this.cacheService.zAdd(
                OrderExpireRedisKeys.delayZset,
                paymentExpiresAt.getTime(),
                orderId,
            );
        } catch (error) {
            this.logger.error(
                `写入支付超时延迟队列失败: ${orderId}`,
                this.extractErrorMessage(error),
            );
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    async clearPaymentExpirationSchedule(orderId: string) {
        if (!orderId) {
            return;
        }
        try {
            await this.cacheService.zRem(
                OrderExpireRedisKeys.delayZset,
                orderId,
            );
        } catch (error) {
            this.logger.warn(
                `清理支付超时延迟队列失败: ${orderId}`,
                this.extractErrorMessage(error),
            );
        }
    }

    private async emitAssignmentDecisionEvent({
        orderId,
        decisionStatus,
        operatorId,
        status,
    }: {
        orderId: string;
        decisionStatus: 'accepted' | 'rejected';
        operatorId: string;
        status: OrderStatus;
    }) {
        const message =
            decisionStatus === 'accepted'
                ? '服务人员已接单'
                : '服务人员拒绝接单';
        try {
            await this.cacheService.xAdd(
                OrderExpireRedisKeys.notifyStream,
                '*',
                {
                    event: 'order_assignment_decision',
                    orderId,
                    status,
                    decisionStatus,
                    operatorId,
                    message,
                    triggeredAt: new Date().toISOString(),
                },
            );
        } catch (error) {
            this.logger.warn(
                `派发接单通知失败: ${orderId}`,
                this.extractErrorMessage(error),
            );
        }
    }

    /**
     * 获取客户的订单列表
     * @param params 查询参数
     * @returns 订单列表和分页信息
     */
    async getOrdersByCustomerId(params: OrderListRequest) {
        // 验证时间参数
        if (
            params.startTime &&
            params.endTime &&
            params.startTime > params.endTime
        ) {
            throw new BadRequestException('开始时间不能晚于结束时间');
        }

        try {
            return await this.orderRepository.getOrdersByCustomerId({
                customerId: params.customerId,
                page: params.page || 1,
                limit: params.limit || 10,
                status: params.status,
                startTime: params.startTime,
                endTime: params.endTime,
                sortBy: params.sortBy || 'createdAt',
                sortOrder: params.sortOrder || 'desc',
            });
        } catch (error) {
            throw new BadRequestException(
                `获取订单列表失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    async getOrdersByStaff(params: StaffOrderListRequest) {
        if (
            params.startTime &&
            params.endTime &&
            params.startTime > params.endTime
        ) {
            throw new BadRequestException('开始时间不能晚于结束时间');
        }

        try {
            return await this.orderRepository.getOrdersByStaffId({
                servicePersonnelId: params.servicePersonnelId,
                page: params.page || 1,
                limit: params.limit || 10,
                status: params.status,
                startTime: params.startTime,
                endTime: params.endTime,
                onlyAccepted: params.onlyAccepted,
            });
        } catch (error) {
            throw new BadRequestException(
                `获取服务人员订单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * 根据订单ID获取单个订单信息
     * @param id 订单ID
     * @param userId 用户ID（用于权限验证）
     * @returns 订单详情
     */
    async getOrderById(id: string, userId?: string) {
        // 参数验证
        if (!id) {
            throw new BadRequestException('订单ID不能为空');
        }

        try {
            const order = await this.orderRepository.getOrderById(id);
            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            if (userId) {
                const isCustomer = order.customerId === userId;

                const isAssignedStaff =
                    order.assignment?.servicePersonnel?.userId === userId;

                if (!isCustomer && !isAssignedStaff) {
                    throw new BadRequestException('您没有权限查看此订单');
                }
            }

            return { ...order };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException(
                `获取订单详情失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * 创建用户指定服务人员的订单
     */
    async createOrderWithDesignatedPersonnel(
        createOrderDto: CreateDesignatedOrder,
    ) {
        const appointmentTime = new Date(createOrderDto.appointmentTime);
        const paymentExpiresAt = this.calculatePaymentExpiresAt();

        // 验证预约时间是否合理
        if (appointmentTime < new Date()) {
            throw new BadRequestException('预约时间不能是过去的时间');
        }

        // 验证用户是否在尝试购买自己发布的服务
        if (
            createOrderDto.customerId === createOrderDto.designatedPersonnelId
        ) {
            throw new BadRequestException('不能购买自己发布的服务');
        }

        // 数据验证
        const ServicePersonnel = await this.workSkillService.getPersonnelInfo(
            createOrderDto.designatedPersonnelId,
            createOrderDto.serviceId,
        );

        // 1. 当前服务人员是否存在
        if (!ServicePersonnel?.userId) {
            throw new BadRequestException('服务人员不存在');
        }
        // 2. 服务人员是否能够提供该服务
        const hasSkill = ServicePersonnel.skills.some(
            (skill) => skill.id === createOrderDto.serviceId,
        );
        if (!hasSkill) {
            throw new BadRequestException('服务人员不能提供该服务');
        }

        // 3. 当前服务人员是否处于工作状态
        if (!ServicePersonnel.isAvailable) {
            throw new BadRequestException('服务人员当前正在休息');
        }

        // 4. 申请的服务时间是否在工作人员的工作时间内
        const { weekday, timeStr } = extractParams(appointmentTime);
        // 检查是否是工作日
        if (!ServicePersonnel.workDays.includes(weekday.toString())) {
            throw new BadRequestException('服务时间不在工作人员的工作日列表中');
        }

        // 检查是否在工作时间段内
        if (
            !isTimeInRange(
                timeStr,
                ServicePersonnel.workStartTime,
                ServicePersonnel.workEndTime,
            )
        ) {
            throw new BadRequestException('服务时间不在工作人员的工作时间段内');
        }

        // 5. 获取服务规格信息（价格和时长）
        // 从servicePersonnelPricing表中查询指定的服务规格
        const specification =
            await this.orderRepository.getServiceSpecification(
                createOrderDto.specificationId,
            );

        if (!specification) {
            throw new BadRequestException('服务规格不存在');
        }

        // 验证规格是否属于当前服务人员和服务
        if (
            specification.userId !== createOrderDto.designatedPersonnelId ||
            specification.serviceId !== createOrderDto.serviceId
        ) {
            throw new BadRequestException('服务规格与服务人员或服务不匹配');
        }

        // 验证规格是否有效
        if (!specification.isActive) {
            throw new BadRequestException('服务规格已失效');
        }

        // 6. 在相同的时间段中该工作人员是否有其他订单
        // 使用规格中的服务时长计算订单结束时间
        const appointmentStartTime = new Date(createOrderDto.appointmentTime);
        const estimatedDuration = specification.estimatedDurationMinutes;
        const appointmentEndTime = new Date(appointmentStartTime);
        appointmentEndTime.setMinutes(
            appointmentEndTime.getMinutes() + estimatedDuration,
        );

        // 查询该时间段内是否已有其他订单
        const existingOrders =
            await this.orderRepository.getOrdersByPersonnelAndTimeRange(
                createOrderDto.designatedPersonnelId,
                appointmentStartTime,
                appointmentEndTime,
            );

        // 检查是否有时间冲突的订单
        const hasConflictingOrder = existingOrders.some((order) => {
            // 如果订单状态是已取消或已退款，则不视为冲突
            if (
                order.status === 'cancelled' ||
                order.status === 'refunded' ||
                order.status === 'pending_payment' ||
                order.status === 'payment_timeout'
            ) {
                return false;
            }

            // 获取该订单的服务规格信息
            if (!order.specificationId) {
                return false;
            }

            // 从订单中获取预约时间
            const orderStartTime = new Date(order.appointmentTime);
            const orderDuration =
                order.specification?.estimatedDurationMinutes || 0;
            const orderEndTime = new Date(orderStartTime);
            orderEndTime.setMinutes(orderEndTime.getMinutes() + orderDuration);

            // 检查时间是否重叠
            // 重叠条件：当前订单开始时间 < 查询订单结束时间 且 当前订单结束时间 > 查询订单开始时间
            return (
                orderStartTime < appointmentEndTime &&
                orderEndTime > appointmentStartTime
            );
        });

        if (hasConflictingOrder) {
            throw new BadRequestException('该时间段工作人员已有其他订单');
        }

        // 7. 计算定价
        /**
         * 定价计算方案
         * 1. 以用户传入的其在应用中看到的价格为准
         * 2. 同时校验最新的定价信息（从specification中获取）
         * 3. 如果用户传入的定价和最新定价之间的差距在±30%之外，则触发警告，让用户刷新页面后重新下单
         */
        const userPrice = createOrderDto.displayPrice; // 用户看到的价格
        const latestPrice = parseFloat(specification.price);
        if (!Number.isFinite(latestPrice) || latestPrice <= 0) {
            throw new BadRequestException('服务定价信息异常，请稍后重试');
        }

        // 计算价格差异百分比
        const priceDifference = Math.abs(userPrice - latestPrice) / latestPrice;

        // 如果价格差异超过30%，则抛出异常
        if (priceDifference > 0.3) {
            throw new BadRequestException('价格已更新，请刷新页面后重新下单');
        }

        // 8. 调用创建订单方法
        try {
            const result =
                await this.orderRepository.createOrderWithDesignatedPersonnel({
                    customerId: createOrderDto.customerId,
                    serviceId: createOrderDto.serviceId,
                    addressId: createOrderDto.addressId,
                    specificationId: createOrderDto.specificationId,
                    appointmentTime: appointmentTime,
                    discountAmount:
                        createOrderDto?.discountAmount?.toString() || '0',
                    designatedPersonnelId: createOrderDto.designatedPersonnelId,
                    price: userPrice.toString(), // 使用用户看到的价格
                    paymentExpiresAt,
                });

            try {
                await this.schedulePaymentExpiration(
                    result.orderId,
                    paymentExpiresAt,
                );
            } catch (error) {
                await this.orderRepository
                    .cancelOrder(
                        result.orderId,
                        '系统异常：支付超时任务注册失败',
                    )
                    .catch((cancelError) => {
                        this.logger.error(
                            `订单 ${result.orderId} 回滚失败`,
                            this.extractErrorMessage(cancelError),
                        );
                    });
                throw new BadRequestException(
                    `创建指定服务人员订单失败: ${this.extractErrorMessage(error)}`,
                );
            }

            return {
                orderId: result.orderId,
            };
        } catch (error) {
            throw new BadRequestException(
                `创建指定服务人员订单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * 更新订单状态
     * @param id 订单ID
     * @param newStatus 新的订单状态
     * @param userId 用户ID（用于权限验证）
     * @returns 更新后的订单信息
     */
    async updateOrderStatus(
        id: string,
        newStatus: OrderStatus,
        { tx }: { tx?: DbType },
    ) {
        // 参数验证
        if (!id) {
            throw new BadRequestException('订单ID不能为空');
        }

        if (!newStatus) {
            throw new BadRequestException('订单状态不能为空');
        }

        try {
            // 验证订单是否存在
            const order = await this.orderRepository.getOrderById(id);
            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            // 更新订单状态
            const updatedOrder = await this.orderRepository.updateOrderStatus(
                id,
                newStatus,
                tx,
            );

            if (!tx && newStatus !== 'pending_payment') {
                await this.clearPaymentExpirationSchedule(id);
            }

            return updatedOrder;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException(
                `更新订单状态失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * 取消订单
     * @param id 订单ID
     * @param reason 取消原因
     * @param cancelledById 取消订单的用户ID
     * @returns 取消后的订单信息
     */
    /**
     * 取消订单
     */

    async cancelOrder({
        id,
        reason,
        actorId,
        actorRole,
    }: {
        id: string;
        reason: string;
        actorId: string;
        actorRole: UserRole;
    }) {
        if (!id) {
            throw new BadRequestException('订单ID不能为空');
        }

        if (!reason) {
            throw new BadRequestException('取消原因不能为空');
        }

        if (!actorId) {
            throw new BadRequestException('取消操作的用户ID不能为空');
        }

        const roleLabel =
            actorRole === 'service_personnel'
                ? 'service_personnel'
                : 'customer';
        const finalReason = `[${roleLabel}] ${reason}`;

        try {
            const order = await this.orderRepository.getOrderById(id);
            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            if (order.status === 'paid') {
                await this.payService.requestRefund(id, finalReason, actorId);
            }

            const cancelledOrder = await this.orderRepository.cancelOrder(
                id,
                finalReason,
                actorId,
            );
            await this.clearPaymentExpirationSchedule(id);
            return cancelledOrder;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `取消订单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    async cancelOrderBySystem(id: string, reason = '支付超时系统自动取消') {
        if (!id) {
            throw new BadRequestException('订单ID不能为空');
        }

        const order = await this.orderRepository.getOrderById(id);
        if (!order) {
            return null;
        }

        if (order.status !== 'pending_payment') {
            return order;
        }

        const updated = await this.orderRepository.markOrderPaymentTimeout(
            id,
            reason,
        );
        await this.clearPaymentExpirationSchedule(id);
        return updated;
    }

    async acceptAssignment(orderId: string, staffId: string) {
        if (!orderId) {
            throw new BadRequestException('订单ID不能为空');
        }
        if (!staffId) {
            throw new BadRequestException('服务人员信息缺失');
        }

        try {
            await this.orderRepository.acceptAssignment(orderId, staffId);
            const updatedOrder =
                await this.orderRepository.getOrderById(orderId);
            if (updatedOrder) {
                await this.emitAssignmentDecisionEvent({
                    orderId,
                    decisionStatus: 'accepted',
                    operatorId: staffId,
                    status: updatedOrder.status as OrderStatus,
                });
            }
            return updatedOrder;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `接单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    async rejectAssignment(orderId: string, staffId: string, reason: string) {
        if (!orderId) {
            throw new BadRequestException('订单ID不能为空');
        }
        if (!staffId) {
            throw new BadRequestException('服务人员信息缺失');
        }
        const trimmedReason = reason?.trim();
        if (!trimmedReason) {
            throw new BadRequestException('拒绝原因不能为空');
        }

        try {
            await this.orderRepository.rejectAssignment(
                orderId,
                staffId,
                trimmedReason,
            );
            const updatedOrder =
                await this.orderRepository.getOrderById(orderId);

            if (!updatedOrder) {
                throw new BadRequestException('订单不存在');
            }

            if (updatedOrder.status === 'staff_rejected') {
                const finalReason = `[service_personnel] ${trimmedReason}`;
                await this.payService.requestRefund(
                    orderId,
                    finalReason,
                    staffId,
                );
            }
            if (updatedOrder.assignment?.decisionStatus === 'rejected') {
                await this.emitAssignmentDecisionEvent({
                    orderId,
                    decisionStatus: 'rejected',
                    operatorId: staffId,
                    status: updatedOrder.status as OrderStatus,
                });
            }

            return updatedOrder;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `拒绝接单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * 完成订单
     * @param id 订单ID
     * @returns 完成后的订单信息
     */
    async completeOrder(id: string, userId?: string) {
        // 参数验证
        if (!id) {
            throw new BadRequestException('订单ID不能为空');
        }
        try {
            // 验证订单是否存在
            const order = await this.orderRepository.getOrderById(id);
            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            if (userId && order.customerId !== userId) {
                throw new BadRequestException('只有订单创建者可以完成此订单');
            }
            // 验证订单状态是否可以完成
            if (order.status !== 'in_progress') {
                throw new BadRequestException('订单必须处于服务中状态才能完成');
            }

            // 更新订单状态为 completed
            const updatedOrder = await this.orderRepository.updateOrderStatus(
                id,
                'completed',
            );

            // 订单完成后处理收益分配
            await this.payService.handleOrderCompletion(id);

            return updatedOrder;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `完成订单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }
}
