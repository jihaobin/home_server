import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import type {
    CreateDesignatedOrder,
    NotificationDeliveryMode,
    NotificationEventPayload,
    OrderConfirmDesignatedPreviewQuery,
    OrderConfirmDesignatedPreviewResponse,
    Pricing,
    OrderListRequest,
    OrderCardsTab,
    OrderCardsListResponse,
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
import {
    extractParams,
    isAlignedToWorkStartTimeGrid,
    isTimeInRange,
} from 'src/lib/utlis';
import { PayService } from '../pay/pay.service';
import { WorkSkillService } from '../work-skill/work-skill.service';
import { ServiceService } from '../service/service.service';
import { AddressRespository } from '../address/address.repository';
import { ServicePersonnelRepository } from '../service-personnel/service-personnel.repository';
import { NotificationPublisher } from '../notification/notification.publisher';
import { NotificationTemplateService } from '../notification/notification-template.service';
import {
    OrderRepository,
    type OrderStatus as DbOrderStatus,
} from './order.reposityro';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';
import {
    PendingAcceptanceReminderRedisKeys,
    PENDING_ACCEPTANCE_REMINDER_SEQUENCE,
    type PendingAcceptanceReminderTask,
} from './pending-acceptance-reminder.constants';
import {
    ServiceEtaReminderRedisKeys,
    SERVICE_ETA_REMINDER_SEQUENCE,
    type ServiceEtaReminderTask,
} from './service-eta-reminder.constants';

type DetailedOrder = Awaited<ReturnType<OrderRepository['getOrderById']>>;

interface ServiceNotificationConfig {
    event: string;
    message: string;
    payload?: Partial<NotificationEventPayload>;
    deliveryMode?: NotificationDeliveryMode;
}

interface PendingAcceptanceReminderEntry {
    member: PendingAcceptanceReminderTask;
    score: number;
    payload: PendingAcceptanceReminderTask;
    formattedTime: string;
}

interface ServiceEtaReminderEntry {
    member: ServiceEtaReminderTask;
    score: number;
    payload: ServiceEtaReminderTask;
    formattedTime: string;
}

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);
    constructor(
        private readonly notificationTemplateService: NotificationTemplateService,
    ) {}

    @Inject(OrderRepository)
    private readonly orderRepository: OrderRepository;

    @Inject(WorkSkillService)
    private readonly workSkillService: WorkSkillService;

    @Inject(ServiceService)
    private readonly serviceService: ServiceService;

    @Inject(AddressRespository)
    private readonly addressRepository: AddressRespository;

    @Inject(ServicePersonnelRepository)
    private readonly servicePersonnelRepository: ServicePersonnelRepository;

    @Inject(forwardRef(() => PayService))
    private readonly payService: PayService;

    @Inject(ConfigService)
    private readonly configService: ConfigService;

    @Inject(CACHE_SERVICE)
    private readonly cacheService: IAdvancedCacheService;

    @Inject(NotificationPublisher)
    private readonly notificationPublisher: NotificationPublisher;

    @Inject(S3StoreServer)
    private readonly s3StoreServer: S3StoreServer;

    private readonly defaultPaymentExpireMinutes = 15;
    private readonly defaultPendingAcceptanceTimeoutMinutes = 120;

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

    private getPendingAcceptanceTimeoutMs(): number {
        const configuredMinutes = Number(
            this.configService.get('ORDER_PENDING_ACCEPTANCE_TIMEOUT_MINUTES'),
        );
        const minutes =
            Number.isFinite(configuredMinutes) && configuredMinutes > 0
                ? configuredMinutes
                : this.defaultPendingAcceptanceTimeoutMinutes;
        return minutes * 60 * 1000;
    }

    private calculatePendingAcceptanceDeadline(
        order: DetailedOrder | null,
    ): Date | null {
        if (!order) {
            return null;
        }
        const appointment = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        if (appointment && !Number.isNaN(appointment.getTime())) {
            return appointment;
        }
        if (!order.assignment) {
            return null;
        }
        const base =
            order.assignment.assignedAt ??
            order.updatedAt ??
            order.createdAt ??
            null;
        if (!base) {
            return null;
        }
        const baseDate = base instanceof Date ? base : new Date(base);
        if (Number.isNaN(baseDate.getTime())) {
            return null;
        }
        const deadline = new Date(
            baseDate.getTime() + this.getPendingAcceptanceTimeoutMs(),
        );
        if (Number.isNaN(deadline.getTime())) {
            return null;
        }
        return deadline;
    }

    private buildPendingAcceptanceReminderEntries(
        order: DetailedOrder | null,
        deadline: Date,
    ): PendingAcceptanceReminderEntry[] {
        if (!order?.assignment?.id) {
            return [];
        }
        const assignmentId = order.assignment.id;
        if (!assignmentId) {
            return [];
        }
        const deadlineMs = deadline.getTime();
        const entries: PendingAcceptanceReminderEntry[] = [];
        for (const definition of PENDING_ACCEPTANCE_REMINDER_SEQUENCE) {
            const scheduledAtMs = deadlineMs - definition.offsetMs;
            if (!Number.isFinite(scheduledAtMs) || scheduledAtMs <= 0) {
                continue;
            }
            const scheduledAt = new Date(scheduledAtMs);
            const payload: PendingAcceptanceReminderTask = {
                orderId: order.id,
                assignmentId,
                stage: definition.stage,
                deadline: deadline.toISOString(),
                scheduledAt: scheduledAt.toISOString(),
                warningLevel: definition.warningLevel,
            };
            entries.push({
                payload,
                member: payload,
                score: scheduledAtMs,
                formattedTime: scheduledAt.toISOString(),
            });
        }
        return entries;
    }

    private async removePendingAcceptanceReminders(
        entries: PendingAcceptanceReminderEntry[],
    ): Promise<number> {
        if (!entries.length) {
            return 0;
        }
        try {
            const removed = await this.cacheService.zRem(
                PendingAcceptanceReminderRedisKeys.scheduleZset,
                ...entries.map((entry) => entry.member),
            );
            return removed;
        } catch (error) {
            this.logger.warn(
                '清理待接单提醒调度失败',
                this.extractErrorMessage(error),
            );
            return 0;
        }
    }

    private async clearPendingAcceptanceReminderSchedules(
        order: DetailedOrder | null,
    ) {
        if (!order?.assignment?.id) {
            return;
        }
        const deadline = this.calculatePendingAcceptanceDeadline(order);
        if (!deadline) {
            return;
        }
        const entries = this.buildPendingAcceptanceReminderEntries(
            order,
            deadline,
        );
        const removed = await this.removePendingAcceptanceReminders(entries);
        if (removed > 0) {
            this.logger.debug?.(
                `订单 ${order.id} 清理 ${removed} 条历史待接单提醒`,
            );
        }
    }

    private buildServiceEtaReminderEntries(
        order: DetailedOrder | null,
        appointment: Date,
    ): ServiceEtaReminderEntry[] {
        if (!order?.assignment?.id) {
            return [];
        }
        const appointmentMs = appointment.getTime();
        if (!Number.isFinite(appointmentMs)) {
            return [];
        }
        const windowMs = 2 * 60 * 60 * 1000;
        const deadlineMs = appointmentMs + windowMs;
        const appointmentWindowEndTime = new Date(deadlineMs).toISOString();
        const entries: ServiceEtaReminderEntry[] = [];
        for (const definition of SERVICE_ETA_REMINDER_SEQUENCE) {
            const scheduledAtMs = deadlineMs - definition.offsetMs;
            if (!Number.isFinite(scheduledAtMs) || scheduledAtMs <= 0) {
                continue;
            }
            const scheduledAt = new Date(scheduledAtMs);
            const payload: ServiceEtaReminderTask = {
                orderId: order.id,
                assignmentId: order.assignment.id,
                stage: definition.stage,
                appointmentTime: appointment.toISOString(),
                appointmentWindowEndTime,
                scheduledAt: scheduledAt.toISOString(),
                warningLevel: definition.warningLevel,
            };
            entries.push({
                payload,
                member: payload,
                score: scheduledAtMs,
                formattedTime: scheduledAt.toISOString(),
            });
        }
        return entries;
    }

    private async removeServiceEtaReminders(
        entries: ServiceEtaReminderEntry[],
    ): Promise<number> {
        if (!entries.length) {
            return 0;
        }
        try {
            return await this.cacheService.zRem(
                ServiceEtaReminderRedisKeys.scheduleZset,
                ...entries.map((entry) => entry.member),
            );
        } catch (error) {
            this.logger.warn(
                '清理上门提醒调度失败',
                this.extractErrorMessage(error),
            );
            return 0;
        }
    }

    private async clearServiceEtaReminderSchedules(
        order: DetailedOrder | null,
    ) {
        if (!order?.assignment?.id) {
            return;
        }
        const appointment = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        if (!appointment || Number.isNaN(appointment.getTime())) {
            return;
        }
        const entries = this.buildServiceEtaReminderEntries(order, appointment);
        const removed = await this.removeServiceEtaReminders(entries);
        if (removed > 0) {
            this.logger.debug?.(
                `订单 ${order.id} 清理 ${removed} 条上门提醒调度`,
            );
        }
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

    async notifyPendingAcceptance(orderId: string) {
        if (!orderId) {
            return;
        }
        const order = await this.orderRepository.getOrderById(orderId);
        if (!order) {
            return;
        }
        const message = this.notificationTemplateService.getTemplate(
            'order_pending_acceptance_assigned',
            {
                serviceName: order.service?.name ?? order.serviceId,
            },
        );
        await this.notifyServicePersonnel(order, {
            event: 'order_pending_acceptance_assigned',
            message,
            deliveryMode: 'strict',
            payload: {
                status: order.status,
                appointmentTime: order.appointmentTime
                    ? new Date(order.appointmentTime).toISOString()
                    : undefined,
                totalAmount: order.totalAmount,
                serviceName: order.service?.name ?? order.serviceId,
                assignmentType: order.assignment?.assignmentType ?? undefined,
            },
        });
        await this.schedulePendingAcceptanceReminders(order);
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
        const templateKey =
            decisionStatus === 'accepted'
                ? 'order_assignment_decision_accepted'
                : 'order_assignment_decision_rejected';
        const message = this.notificationTemplateService.getTemplate(
            templateKey,
            {
                decisionStatus,
                orderId,
            },
        );
        try {
            await this.notificationPublisher.publish({
                event: 'order_assignment_decision',
                payload: {
                    event: 'order_assignment_decision',
                    orderId,
                    status,
                    decisionStatus,
                    operatorId,
                    message,
                    userId: operatorId,
                    targetId: operatorId,
                    triggeredAt: new Date().toISOString(),
                },
                targets: [
                    {
                        targetId: operatorId,
                        userId: operatorId,
                        targetType: 'service_personnel',
                    },
                ],
            });
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

    private resolveOrderCardsTabFilter(tab: OrderCardsTab): {
        statuses?: DbOrderStatus[];
        needsReviewOnly?: boolean;
    } {
        switch (tab) {
            case 'all':
                return {};
            case 'pending_payment':
                return { statuses: ['pending_payment'] };
            case 'paid':
                // paid tab 语义：pending_acceptance + paid
                return { statuses: ['pending_acceptance', 'paid'] };
            case 'in_progress':
                return { statuses: ['in_progress'] };
            case 'needs_review':
                // needs_review tab：completed 且 needsReview=true
                return { needsReviewOnly: true };
            default:
                // TS 理论上不可达；运行时兜底。
                return {};
        }
    }

    /**
     * 用户端订单列表页：卡片列表接口（专用）
     */
    async getOrderCardsByCustomerId(params: {
        customerId: string;
        tab: OrderCardsTab;
        page: number;
        limit: number;
    }): Promise<OrderCardsListResponse> {
        // Query schema 不限制 limit；这里对数据库执行做一个软上限。
        // 同时保证 meta.limit 不会超过 @repo/types 的 PaginationMetaSchema 约束（max=1000）。
        const limit = Math.min(params.limit, 1000);

        const { statuses, needsReviewOnly } = this.resolveOrderCardsTabFilter(
            params.tab,
        );

        const result = await this.orderRepository.getOrderCardsByCustomerId({
            customerId: params.customerId,
            page: params.page,
            limit,
            statuses,
            needsReviewOnly,
        });

        return {
            items: await Promise.all(
                result.items.map(async (item) => {
                    const appointment =
                        item.appointmentTime instanceof Date
                            ? item.appointmentTime
                            : new Date(item.appointmentTime);

                    const paymentExpires = item.paymentExpiresAt
                        ? item.paymentExpiresAt instanceof Date
                            ? item.paymentExpiresAt
                            : new Date(item.paymentExpiresAt)
                        : null;

                    return {
                        id: item.id,
                        // 已确认：title = serviceName
                        title: item.serviceName,
                        status: item.status,
                        workerName: item.workerName,
                        workerAvatar: item.workerAvatar ?? null,
                        workerAvatarUrl:
                            item.workerAvatarBucketName &&
                            item.workerAvatarObjectPath
                                ? await this.s3StoreServer.getPresignedDownloadUrl(
                                      item.workerAvatarBucketName,
                                      item.workerAvatarObjectPath,
                                      600,
                                  )
                                : null,
                        workerAvatarBlurhash: item.workerAvatarBlurhash ?? null,
                        serviceName: item.serviceName,
                        serviceId: item.serviceId,
                        servicePersonnelId: item.servicePersonnelId ?? null,
                        itemCount: 1,
                        appointmentTime: appointment.toISOString(),
                        totalAmount: item.totalAmount,
                        paymentExpiresAt: paymentExpires
                            ? paymentExpires.toISOString()
                            : null,
                        needsReview: item.needsReview,
                    };
                }),
            ),
            meta: result.meta,
        };
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

            // 订单详情页强依赖：金额字段统一 number 化，动作语义由后端裁决。
            const originalAmount = new Decimal(order.originalAmount)
                .toDecimalPlaces(2)
                .toNumber();
            const discountAmount = new Decimal(order.discountAmount ?? 0)
                .toDecimalPlaces(2)
                .toNumber();
            const totalAmount = new Decimal(order.totalAmount)
                .toDecimalPlaces(2)
                .toNumber();

            const paymentExpiresAt =
                order.paymentExpiresAt instanceof Date
                    ? order.paymentExpiresAt
                    : new Date(order.paymentExpiresAt);

            const now = new Date();
            const canCancel = [
                'pending_payment',
                'pending_acceptance',
                'paid',
                'staff_rejected',
            ].includes(order.status);

            const canPay =
                order.status === 'pending_payment' &&
                !Number.isNaN(paymentExpiresAt.getTime()) &&
                paymentExpiresAt.getTime() > now.getTime();

            const showCheckinQr =
                order.status === 'paid' || order.status === 'in_progress';

            const {
                serviceImageBucketName,
                serviceImageObjectPath,
                serviceImageBlurhash,
                personnelAvatarBucketName,
                personnelAvatarObjectPath,
                personnelAvatarBlurhash,
                ...safeOrder
            } = order;

            const [serviceImageUrl, personnelAvatarUrl] = await Promise.all([
                serviceImageBucketName && serviceImageObjectPath
                    ? this.s3StoreServer.getPresignedDownloadUrl(
                          serviceImageBucketName,
                          serviceImageObjectPath,
                          600,
                      )
                    : Promise.resolve(null),
                personnelAvatarBucketName && personnelAvatarObjectPath
                    ? this.s3StoreServer.getPresignedDownloadUrl(
                          personnelAvatarBucketName,
                          personnelAvatarObjectPath,
                          600,
                      )
                    : Promise.resolve(null),
            ]);

            const normalizedPayments = Array.isArray(safeOrder.payments)
                ? safeOrder.payments.map((payment: any) => {
                      const amount =
                          typeof payment?.amount === 'string' ||
                          typeof payment?.amount === 'number'
                              ? new Decimal(payment.amount)
                                    .toDecimalPlaces(2)
                                    .toNumber()
                              : payment?.amount;
                      return {
                          ...payment,
                          amount,
                      };
                  })
                : safeOrder.payments;

            const service = safeOrder.service
                ? {
                      ...safeOrder.service,
                      imageUrl: serviceImageUrl,
                      imageBlurhash: serviceImageBlurhash ?? null,
                      // 保持旧字段兼容：如果消费端仍读取 imageFileUrl，也能直接用。
                      imageFileUrl: serviceImageUrl ?? null,
                  }
                : null;

            const assignment = safeOrder.assignment
                ? {
                      ...safeOrder.assignment,
                      servicePersonnel: safeOrder.assignment.servicePersonnel
                          ? {
                                ...safeOrder.assignment.servicePersonnel,
                                avatarUrl:
                                    personnelAvatarUrl ??
                                    safeOrder.assignment.servicePersonnel
                                        .avatarUrl ??
                                    safeOrder.assignment.servicePersonnel
                                        .avatar ??
                                    null,
                                avatarBlurhash: personnelAvatarBlurhash ?? null,
                            }
                          : safeOrder.assignment.servicePersonnel,
                  }
                : null;

            return {
                ...safeOrder,
                originalAmount,
                discountAmount,
                totalAmount,
                payments: normalizedPayments,
                service,
                assignment,
                canCancel,
                canPay,
                showCheckinQr,
            };
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
     * 确认订单预览（指定服务人员下单）
     *
     * 目标：创建订单前返回确认页渲染所需的聚合数据与 pricing（v1 仅 service_fee）。
     */
    async getConfirmDesignatedPreview(
        params: { customerId: string } & OrderConfirmDesignatedPreviewQuery,
    ): Promise<OrderConfirmDesignatedPreviewResponse> {
        const {
            customerId,
            personnelId,
            serviceId,
            specificationId,
            addressId,
            appointmentTime,
            couponCode,
        } = params;

        const address = addressId
            ? await this.addressRepository.findByIdAndUserId(
                  addressId,
                  customerId,
              )
            : await this.addressRepository.findDefaultByUserId(customerId);

        if (addressId && !address) {
            throw new BadRequestException('地址不存在或无权限');
        }

        const details =
            await this.servicePersonnelRepository.getPersonnelServiceDetails(
                personnelId,
                serviceId,
            );

        if (!details) {
            throw new BadRequestException('服务人员或服务不存在');
        }

        const rawSpecs = details.specifications ?? [];
        if (rawSpecs.length === 0) {
            throw new BadRequestException('该服务暂无可用定价');
        }

        const specifications = rawSpecs.map((spec: any) => ({
            id: String(spec.id),
            userId: String(spec.userId),
            serviceId: String(spec.serviceId),
            name:
                typeof spec.name === 'string' && spec.name.trim()
                    ? spec.name.trim()
                    : undefined,
            price: String(spec.price),
            currency: String(spec.currency ?? 'CNY'),
            estimatedDurationMinutes:
                typeof spec.estimatedDurationMinutes === 'number'
                    ? spec.estimatedDurationMinutes
                    : undefined,
        }));

        const selectedSpecification = specificationId
            ? specifications.find((spec) => spec.id === specificationId)
            : (() => {
                  let best = specifications[0];
                  let bestPrice = new Decimal(best.price);
                  for (const spec of specifications.slice(1)) {
                      const price = new Decimal(spec.price);
                      if (price.lessThan(bestPrice)) {
                          best = spec;
                          bestPrice = price;
                      }
                  }
                  return best;
              })();

        if (specificationId && !selectedSpecification) {
            throw new BadRequestException('服务规格不存在或已失效');
        }

        if (!selectedSpecification) {
            throw new BadRequestException('服务规格不存在');
        }

        const service = await this.serviceService.getServiceById(serviceId);
        if (!service) {
            throw new BadRequestException('服务不存在');
        }

        const latestPrice = new Decimal(selectedSpecification.price)
            .toDecimalPlaces(2)
            .toNumber();
        if (!Number.isFinite(latestPrice) || latestPrice <= 0) {
            throw new BadRequestException('服务定价信息异常，请稍后重试');
        }

        const pricing: Pricing = {
            currency: selectedSpecification.currency || 'CNY',
            items: [
                {
                    key: 'service_fee',
                    label: '服务费用',
                    amount: latestPrice,
                },
            ],
            originalAmount: latestPrice,
            discountAmount: 0,
            totalAmount: latestPrice,
        };

        return {
            address,
            servicePersonnel: {
                userId: details.userId,
                name: details.name,
                avatar: details.avatar,
                bio: details.bio,
                province: details.province,
                district: details.district,
                county: details.county,
                detailedAddress: details.detailedAddress ?? '',
                yearsOfExperience: details.yearsOfExperience,
                workStartTime: details.workStartTime,
                workEndTime: details.workEndTime,
                isAvailable: details.isAvailable,
                workDays: details.workDays,
                currentStatus: details.currentStatus,
                lastActiveAt: details.lastActiveAt,
            },
            service: {
                id: service.id,
                name: service.name,
                imageFileUrl: service.imageFileUrl ?? null,
            },
            specifications,
            selected: {
                specificationId: selectedSpecification.id,
                addressId: address?.id,
                appointmentTime,
                couponCode,
            },
            pricing,
            paymentExpiresAt: this.calculatePaymentExpiresAt().toISOString(),
        };
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

        // 4.1 2 小时网格对齐校验：以 workStartTime 为基准每 +120 分钟。
        if (
            !isAlignedToWorkStartTimeGrid(
                appointmentTime,
                ServicePersonnel.workStartTime,
                120,
            )
        ) {
            throw new BadRequestException(
                '预约时间必须命中从上班时间起算的 2 小时网格点',
            );
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

        // 6. 新语义：不做时间冲突检测（同一时间段允许多单）

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

        const discountAmount = createOrderDto.discountAmount ?? 0;
        if (!Number.isFinite(discountAmount) || discountAmount < 0) {
            throw new BadRequestException('折扣金额不合法');
        }

        if (discountAmount > latestPrice) {
            throw new BadRequestException('折扣金额不能大于服务费用');
        }

        // 计算价格差异百分比
        const priceDifference = Math.abs(userPrice - latestPrice) / latestPrice;

        // 如果价格差异超过30%，则抛出异常
        if (priceDifference > 0.3) {
            throw new BadRequestException('价格已更新，请刷新页面后重新下单');
        }

        // 8. 调用创建订单方法
        try {
            // 二次校验：以服务端最新规格价为准落库，并同步返回 pricing.totalAmount 供支付使用。
            const totalAmount = new Decimal(latestPrice)
                .minus(discountAmount)
                .toDecimalPlaces(2)
                .toNumber();

            const pricing: Pricing = {
                currency: specification.currency || 'CNY',
                items: [
                    {
                        key: 'service_fee',
                        label: '服务费用',
                        amount: new Decimal(latestPrice)
                            .toDecimalPlaces(2)
                            .toNumber(),
                    },
                    ...(discountAmount > 0
                        ? ([
                              {
                                  key: 'promo_discount',
                                  label: '优惠',
                                  amount: new Decimal(discountAmount)
                                      .mul(-1)
                                      .toDecimalPlaces(2)
                                      .toNumber(),
                              },
                          ] as Pricing['items'])
                        : ([] as Pricing['items'])),
                ],
                originalAmount: new Decimal(latestPrice)
                    .toDecimalPlaces(2)
                    .toNumber(),
                discountAmount: new Decimal(discountAmount)
                    .toDecimalPlaces(2)
                    .toNumber(),
                totalAmount,
            };

            const result =
                await this.orderRepository.createOrderWithDesignatedPersonnel({
                    customerId: createOrderDto.customerId,
                    serviceId: createOrderDto.serviceId,
                    addressId: createOrderDto.addressId,
                    specificationId: createOrderDto.specificationId,
                    appointmentTime: appointmentTime,
                    discountAmount: new Decimal(discountAmount)
                        .toDecimalPlaces(2)
                        .toString(),
                    designatedPersonnelId: createOrderDto.designatedPersonnelId,
                    price: new Decimal(latestPrice)
                        .toDecimalPlaces(2)
                        .toString(),
                    paymentExpiresAt,
                    remark: createOrderDto.remark?.trim() || null,
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
                pricing,
                paymentExpiresAt: paymentExpiresAt.toISOString(),
            };
        } catch (error) {
            throw new BadRequestException(
                `创建指定服务人员订单失败: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * 服务人员改期：将 appointmentTime 修改为新的 2 小时窗口起点。
     */
    async rescheduleOrder(params: {
        orderId: string;
        staffId: string;
        appointmentTime: string;
    }) {
        const { orderId, staffId } = params;
        if (!orderId) {
            throw new BadRequestException('订单ID不能为空');
        }
        if (!staffId) {
            throw new BadRequestException('缺少服务人员身份信息');
        }

        const nextAppointment = new Date(params.appointmentTime);
        if (Number.isNaN(nextAppointment.getTime())) {
            throw new BadRequestException('预约时间格式不正确');
        }
        if (nextAppointment < new Date()) {
            throw new BadRequestException('预约时间不能是过去的时间');
        }

        const order = await this.orderRepository.getOrderById(orderId);
        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        if (!order.assignment?.servicePersonnelId) {
            throw new BadRequestException('订单尚未分配服务人员');
        }
        if (order.assignment.servicePersonnelId !== staffId) {
            throw new BadRequestException('订单必须分配给当前服务人员');
        }

        const allowedStatuses: DbOrderStatus[] = ['pending_acceptance', 'paid'];
        if (!allowedStatuses.includes(order.status)) {
            throw new BadRequestException('当前订单状态不允许改期');
        }

        const personnel = await this.workSkillService.getPersonnelInfo(
            staffId,
            order.serviceId,
        );
        if (!personnel?.userId) {
            throw new BadRequestException('服务人员不存在');
        }

        const { weekday, timeStr } = extractParams(nextAppointment);
        if (!personnel.workDays?.includes(weekday.toString())) {
            throw new BadRequestException('服务时间不在工作人员的工作日列表中');
        }
        if (
            !isTimeInRange(
                timeStr,
                personnel.workStartTime,
                personnel.workEndTime,
            )
        ) {
            throw new BadRequestException('服务时间不在工作人员的工作时间段内');
        }
        if (
            !isAlignedToWorkStartTimeGrid(
                nextAppointment,
                personnel.workStartTime,
                120,
            )
        ) {
            throw new BadRequestException(
                '预约时间必须命中从上班时间起算的 2 小时网格点',
            );
        }

        const updated = await this.orderRepository.updateAppointmentTime(
            orderId,
            nextAppointment,
            allowedStatuses,
        );
        if (!updated) {
            throw new BadRequestException('订单改期失败');
        }

        const detailed = await this.orderRepository.getOrderById(orderId);
        await this.scheduleServiceEtaReminders(detailed);
        return detailed;
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

        const finalReason = `${reason}`;

        try {
            const order = await this.orderRepository.getOrderById(id);
            if (!order) {
                throw new BadRequestException('订单不存在');
            }

            const refundableStatuses: OrderStatus[] = [
                'pending_acceptance',
                'paid',
                'staff_rejected',
            ];
            if (refundableStatuses.includes(order.status)) {
                await this.payService.requestRefund(id, finalReason, actorId);
            } else {
                await this.orderRepository.cancelOrder(
                    id,
                    finalReason,
                    actorId,
                );
            }
            await this.clearPaymentExpirationSchedule(id);
            const detailedOrder =
                (await this.orderRepository.getOrderById(id)) ?? order;
            await this.clearPendingAcceptanceReminderSchedules(detailedOrder);
            await this.clearServiceEtaReminderSchedules(detailedOrder);
            await this.notifyOrderCancellation(detailedOrder, finalReason);
            return detailedOrder;
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
                await this.clearPendingAcceptanceReminderSchedules(
                    updatedOrder,
                );
                await this.emitAssignmentDecisionEvent({
                    orderId,
                    decisionStatus: 'accepted',
                    operatorId: staffId,
                    status: updatedOrder.status,
                });
                if (updatedOrder.status === 'paid') {
                    await this.scheduleServiceEtaReminders(updatedOrder);
                }
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
            await this.clearPendingAcceptanceReminderSchedules(updatedOrder);

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
                    status: updatedOrder.status,
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

            // 更新订单状态为 completed，并递增服务完成次数（原子 + 幂等）
            const updatedOrder =
                await this.orderRepository.completeOrderAndIncrementServicedCount(
                    id,
                );

            // 订单完成后处理收益分配
            await this.payService.handleOrderCompletion(id);
            await this.clearServiceEtaReminderSchedules(order);

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

    private async notifyServicePersonnel(
        order: DetailedOrder | null,
        config: ServiceNotificationConfig,
    ) {
        if (!order?.assignment?.servicePersonnel?.userId) {
            return;
        }
        const serviceUserId = order.assignment.servicePersonnel.userId;
        try {
            const payload: NotificationEventPayload = {
                event: config.event,
                orderId: order.id,
                status: order.status,
                appointmentTime: order.appointmentTime
                    ? new Date(order.appointmentTime).toISOString()
                    : undefined,
                serviceName: order.service?.name ?? order.serviceId,
                totalAmount: order.totalAmount,
                message: config.message,
                ...config.payload,
                userId: serviceUserId,
                targetId: serviceUserId,
            };
            await this.notificationPublisher.publish({
                event: config.event,
                payload,
                deliveryMode: config.deliveryMode,
                targets: [
                    {
                        targetId: serviceUserId,
                        userId: serviceUserId,
                        targetType: 'service_personnel',
                    },
                ],
            });
        } catch (error) {
            this.logger.warn(
                `派发服务人员通知失败: ${order.id}`,
                this.extractErrorMessage(error),
            );
        }
    }

    private async notifyOrderCancellation(
        order: DetailedOrder | null,
        reason: string,
    ) {
        if (!order) {
            return;
        }
        const message = this.notificationTemplateService.getTemplate(
            'order_cancelled',
            { reason },
        );
        await this.notifyServicePersonnel(order, {
            event: 'order_cancelled',
            message,
            payload: {
                cancelReason: reason,
            },
        });
    }

    private async schedulePendingAcceptanceReminders(
        order: DetailedOrder | null,
    ) {
        if (
            !order?.assignment?.id ||
            !order.assignment.servicePersonnel?.userId
        ) {
            return;
        }
        if (
            order.status !== 'pending_acceptance' ||
            order.assignment.decisionStatus !== 'pending'
        ) {
            return;
        }
        const deadline = this.calculatePendingAcceptanceDeadline(order);
        if (!deadline) {
            this.logger.warn(
                `订单 ${order.id} 缺少可用于计算待接单超时时间的字段，跳过提醒调度`,
            );
            return;
        }
        const entries = this.buildPendingAcceptanceReminderEntries(
            order,
            deadline,
        );
        if (!entries.length) {
            this.logger.debug?.(
                `订单 ${order.id} 无待接单提醒调度任务，截止 ${deadline.toISOString()}`,
            );
            return;
        }
        this.logger.debug?.(
            `订单 ${order.id} 待接单提醒原始任务: ${entries
                .map((entry) => `${entry.payload.stage}@${entry.formattedTime}`)
                .join(', ')}`,
        );
        const removed = await this.removePendingAcceptanceReminders(entries);
        if (removed > 0) {
            this.logger.debug?.(
                `订单 ${order.id} 清理 ${removed} 条旧待接单提醒后重新写入`,
            );
        }
        const now = Date.now();
        const upcomingEntries = entries.filter((entry) => entry.score > now);
        if (!upcomingEntries.length) {
            this.logger.debug?.(
                `订单 ${order.id} 待接单提醒生成 ${entries.length} 条但全部过期（当前 ${new Date(
                    now,
                ).toISOString()}）`,
            );
            return;
        }
        await Promise.all(
            upcomingEntries.map((entry) =>
                this.cacheService
                    .zAdd(
                        PendingAcceptanceReminderRedisKeys.scheduleZset,
                        entry.score,
                        entry.member,
                    )
                    .then(() =>
                        this.logger.debug?.(
                            `订单 ${order.id} 待接单提醒写入 ${entry.payload.stage} @ ${entry.formattedTime}`,
                        ),
                    )
                    .catch((error) =>
                        this.logger.warn(
                            `订单 ${order.id} 写入待接单提醒 ${entry.payload.stage} 失败`,
                            this.extractErrorMessage(error),
                        ),
                    ),
            ),
        );
        this.logger.debug?.(
            `订单 ${order.id} 待接单提醒已调度，总计 ${upcomingEntries.length} 条，最晚 ${deadline.toISOString()}`,
        );
    }

    private async scheduleServiceEtaReminders(order: DetailedOrder | null) {
        if (
            !order?.assignment?.id ||
            !order.assignment.servicePersonnel?.userId
        ) {
            return;
        }
        if (
            order.assignment.decisionStatus !== 'accepted' ||
            (order.status !== 'paid' && order.status !== 'in_progress')
        ) {
            return;
        }
        const appointment = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        if (!appointment || Number.isNaN(appointment.getTime())) {
            this.logger.warn(
                `订单 ${order.id} 缺少有效预约时间，无法调度上门提醒`,
            );
            return;
        }
        const entries = this.buildServiceEtaReminderEntries(order, appointment);
        if (!entries.length) {
            this.logger.debug?.(
                `订单 ${order.id} 上门提醒生成 0 条任务，预约 ${appointment.toISOString()}`,
            );
            return;
        }
        this.logger.debug?.(
            `订单 ${order.id} 上门提醒原始任务: ${entries
                .map((entry) => `${entry.payload.stage}@${entry.formattedTime}`)
                .join(', ')}`,
        );
        const removed = await this.removeServiceEtaReminders(entries);
        if (removed > 0) {
            this.logger.debug?.(
                `订单 ${order.id} 清理 ${removed} 条旧上门提醒后重新写入`,
            );
        }
        const now = Date.now();
        const futureEntries = entries.filter((entry) => entry.score > now);
        if (!futureEntries.length) {
            this.logger.debug?.(
                `订单 ${order.id} 上门提醒全部过期（当前 ${new Date(
                    now,
                ).toISOString()}）`,
            );
            return;
        }
        await Promise.all(
            futureEntries.map((entry) =>
                this.cacheService
                    .zAdd(
                        ServiceEtaReminderRedisKeys.scheduleZset,
                        entry.score,
                        entry.member,
                    )
                    .then(() =>
                        this.logger.debug?.(
                            `订单 ${order.id} 上门提醒写入 ${entry.payload.stage} @ ${entry.formattedTime}`,
                        ),
                    )
                    .catch((error) =>
                        this.logger.warn(
                            `订单 ${order.id} 写入上门提醒 ${entry.payload.stage} 失败`,
                            this.extractErrorMessage(error),
                        ),
                    ),
            ),
        );
        this.logger.debug?.(
            `订单 ${order.id} 上门提醒已调度，总计 ${futureEntries.length} 条，预约 ${appointment.toISOString()}`,
        );
    }
}
