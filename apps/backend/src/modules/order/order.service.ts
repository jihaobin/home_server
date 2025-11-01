import { BadRequestException, Inject, Injectable, forwardRef } from "@nestjs/common";
import type {
	CreateDesignatedOrder,
	CreateOrder,
	OrderListRequest,
	OrderStatus,
} from "@repo/types";
import { DbType } from "src/common/database/db";
import { extractParams, isTimeInRange } from "src/lib/utlis";
import { PayService } from "../pay/pay.service";
import { ServiceService } from "../service/service.service";
import { WorkSkillService } from "../work-skill/work-skill.service";
import { OrderRepository } from "./order.reposityro";

@Injectable()
export class OrderService {
	@Inject(OrderRepository)
	private readonly orderRepository: OrderRepository;

	@Inject(ServiceService)
	private readonly serviceService: ServiceService;

	@Inject(WorkSkillService)
	private readonly workSkillService: WorkSkillService;

	@Inject(forwardRef(() => PayService))
	private readonly payService: PayService;

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
			throw new BadRequestException("开始时间不能晚于结束时间");
		}

		try {
			return await this.orderRepository.getOrdersByCustomerId({
				customerId: params.customerId,
				page: params.page || 1,
				limit: params.limit || 10,
				status: params.status,
				startTime: params.startTime,
				endTime: params.endTime,
				sortBy: params.sortBy || "createdAt",
				sortOrder: params.sortOrder || "desc",
			});
		} catch (error) {
            throw new BadRequestException(`获取订单列表失败: ${error}`);
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
			throw new BadRequestException("订单ID不能为空");
		}

		try {
			const order = await this.orderRepository.getOrderById(id);
			if (!order) {
				throw new BadRequestException("订单不存在");
			}

			// 如果提供了userId，验证用户是否有权限查看此订单
			if (userId && order.customerId !== userId) {
				// TODO: 这里应该检查更多权限，比如管理员权限
				throw new BadRequestException("您没有权限查看此订单");
			}

			return { ...order };
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`获取订单详情失败: ${error.message}`);
		}
	}

	/**
	 * 创建普通订单
	 * @deprecated 在MVP阶段，所有订单都通过createOrderWithDesignatedPersonnel创建
	 * @param createOrderDto 订单数据
	 * @returns 创建的订单信息
	 */
    // async createOrder(createOrderDto: CreateOrder) {
    // 	// 参数验证
    // 	if (
    // 		!createOrderDto.customerId ||
    // 		!createOrderDto.serviceId ||
    // 		!createOrderDto.addressId ||
    // 		!createOrderDto.appointmentTime
    // 	) {
    // 		throw new BadRequestException("缺少必要参数");
    // 	}

    // 	// 验证预约时间是否合理
    // 	if (createOrderDto.appointmentTime < new Date()) {
    // 		throw new BadRequestException("预约时间不能是过去的时间");
    // 	}

    // 	try {
    // 		// 获取服务基础信息
    // 		const service = await this.serviceService.getServiceById(
    // 			createOrderDto.serviceId,
    // 		);

    // 		if (!service) {
    // 			throw new BadRequestException("服务不存在");
    // 		}

    // 		// 确定订单价格
    // 		const price = service.basePrice;

    // 		// 创建订单
    // 		const result = await this.orderRepository.createOrder({
    // 			...createOrderDto,
    // 			originalAmount: parseFloat(price),
    // 			discountAmount: createOrderDto.discountAmount
    // 				? parseFloat(createOrderDto.discountAmount.toString())
    // 				: 0,
    // 			totalAmount: createOrderDto.discountAmount
    // 				? parseFloat(price) -
    // 					parseFloat(createOrderDto.discountAmount.toString())
    // 				: parseFloat(price),
    // 		});

    // 		return result;
    // 	} catch (error) {
    // 		if (error instanceof BadRequestException) {
    // 			throw error;
    // 		}
    // 		throw new BadRequestException(`创建订单失败: ${error.message}`);
    // 	}
    // }

	/**
	 * 创建用户指定服务人员的订单
	 */
	async createOrderWithDesignatedPersonnel(
		createOrderDto: CreateDesignatedOrder,
	) {
        const appointmentTime = new Date(createOrderDto.appointmentTime);

		// 验证预约时间是否合理
		if (appointmentTime < new Date()) {
			throw new BadRequestException("预约时间不能是过去的时间");
		}

		// 数据验证
		const ServicePersonnel = await this.workSkillService.getPersonnelInfo(
			createOrderDto.designatedPersonnelId,
			createOrderDto.serviceId,
		);

		// 1. 当前服务人员是否存在
		if (!ServicePersonnel?.userId) {
			throw new BadRequestException("服务人员不存在");
		}

		// 2. 服务人员是否能够提供该服务
		const hasSkill = ServicePersonnel.skills.some(
			(skill) => skill.id === createOrderDto.serviceId,
		);
		if (!hasSkill) {
			throw new BadRequestException("服务人员不能提供该服务");
		}

		// 3. 当前服务人员是否处于工作状态
		if (!ServicePersonnel.isAvailable) {
            throw new BadRequestException("服务人员当前正在休息");
		}

		// 4. 申请的服务时间是否在工作人员的工作时间内
		const { weekday, timeStr } = extractParams(appointmentTime);

		// 检查是否是工作日
		if (!ServicePersonnel.workDays.includes(weekday.toString())) {
			throw new BadRequestException("服务时间不在工作人员的工作日列表中");
		}

		// 检查是否在工作时间段内
		if (
			!isTimeInRange(
				timeStr,
				ServicePersonnel.workStartTime,
				ServicePersonnel.workEndTime,
			)
		) {
			throw new BadRequestException("服务时间不在工作人员的工作时间段内");
		}

        // 5. 获取服务规格信息（价格和时长）
        // 从servicePersonnelPricing表中查询指定的服务规格
        const specification = await this.orderRepository.getServiceSpecification(
            createOrderDto.specificationId,
		);

        if (!specification) {
            throw new BadRequestException("服务规格不存在");
        }

        // 验证规格是否属于当前服务人员和服务
        if (
            specification.userId !== createOrderDto.designatedPersonnelId ||
            specification.serviceId !== createOrderDto.serviceId
        ) {
            throw new BadRequestException("服务规格与服务人员或服务不匹配");
        }

        // 验证规格是否有效
        if (!specification.isActive) {
            throw new BadRequestException("服务规格已失效");
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
			if (order.status === "cancelled" || order.status === "refunded") {
				return false;
			}

            // 获取该订单的服务规格信息
            if (!order.specificationId) {
				return false;
			}

            // 从订单中获取预约时间
			const orderStartTime = new Date(order.appointmentTime);
            // 注意：这里需要从order的specification中获取时长
            // 但为了避免额外查询，我们假设existingOrders已经包含了必要的信息
            // 实际上需要在getOrdersByPersonnelAndTimeRange中join specification表
            const orderDuration = order.specification?.estimatedDurationMinutes || 0;
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
			throw new BadRequestException("该时间段工作人员已有其他订单");
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
			throw new BadRequestException("服务定价信息异常，请稍后重试");
		}

		// 计算价格差异百分比
		const priceDifference =
			Math.abs(userPrice - latestPrice) / latestPrice;

		// 如果价格差异超过30%，则抛出异常
		if (priceDifference > 0.3) {
			throw new BadRequestException("价格已更新，请刷新页面后重新下单");
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
					discountAmount: createOrderDto?.discountAmount?.toString() || "0",
					designatedPersonnelId: createOrderDto.designatedPersonnelId,
					price: userPrice.toString(), // 使用用户看到的价格
				});

			return {
				orderId: result.orderId,
			};
		} catch (error) {
			throw new BadRequestException(
				`创建指定服务人员订单失败: ${error.message}`,
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
			throw new BadRequestException("订单ID不能为空");
		}

		if (!newStatus) {
			throw new BadRequestException("订单状态不能为空");
		}

		try {
			// 验证订单是否存在
			const order = await this.orderRepository.getOrderById(id);
			if (!order) {
				throw new BadRequestException("订单不存在");
			}

			// 更新订单状态
			const updatedOrder = await this.orderRepository.updateOrderStatus(
				id,
				newStatus,
				tx,
			);

			return updatedOrder;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`更新订单状态失败: ${error.message}`);
		}
	}

	/**
	 * 取消订单
	 * @param id 订单ID
	 * @param reason 取消原因
	 * @param cancelledById 取消订单的用户ID
	 * @returns 取消后的订单信息
	 */
	async cancelOrder(
		id: string,
		reason: string,
		cancelledById: string,
	) {
		// 参数验证
		if (!id) {
			throw new BadRequestException("订单ID不能为空");
		}

		if (!reason) {
			throw new BadRequestException("取消原因不能为空");
		}

		if (!cancelledById) {
			throw new BadRequestException("取消订单的用户ID不能为空");
		}

		try {
			// 验证订单是否存在
			const order = await this.orderRepository.getOrderById(id);
			if (!order) {
				throw new BadRequestException("订单不存在");
			}

			// 如果订单已支付，需要发起退款并记录取消信息
			if (order.status === "paid") {
				// 调用退款占位函数
				await this.payService.requestRefund(id, reason, cancelledById);

				// 对于已支付的订单，仍标记为取消，但已发起退款
				const cancelledOrder = await this.orderRepository.cancelOrder(
					id,
					reason,
					cancelledById,
				);
				return cancelledOrder;
			} else {
				// 对于未支付的订单，直接取消
				const cancelledOrder = await this.orderRepository.cancelOrder(
					id,
					reason,
					cancelledById,
				);

				return cancelledOrder;
			}
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`取消订单失败: ${error.message}`);
		}
	}

	/**
	 * 完成订单
	 * @param id 订单ID
	 * @returns 完成后的订单信息
	 */
	async completeOrder(
		id: string,
		userId?: string,
	) {
		// 参数验证
		if (!id) {
			throw new BadRequestException("订单ID不能为空");
		}

		try {
			// 验证订单是否存在
			const order = await this.orderRepository.getOrderById(id);
			if (!order) {
				throw new BadRequestException("订单不存在");
			}

			// 验证是否是订单发起者在完成订单
			if (userId && order.customerId !== userId) {
				throw new BadRequestException("只有订单发起者才能完成此订单");
			}

			// 验证订单状态是否可以完成
			if (order.status !== "in_progress") {
				throw new BadRequestException("订单必须处于服务中状态才能完成");
			}

			// 更新订单状态为 completed
			const updatedOrder = await this.orderRepository.updateOrderStatus(
				id,
				"completed",
			);

			// 订单完成后处理收益分配
			await this.payService.handleOrderCompletion(id);

			return updatedOrder;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`完成订单失败: ${error.message}`);
		}
	}
}
