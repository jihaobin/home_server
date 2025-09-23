import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { OrderRepository } from "./order.reposityro";
import { ServiceService } from "../service/service.service";
import { WorkSkillService } from "../work-skill/work-skill.service";
import { CreateOrder, OrderListRequest, OrderStatus } from "@repo/types";
import { CreateDesignatedOrder } from "@repo/types";
import { extractParams, isTimeInRange } from "src/lib/utlis";
import { DbType } from "src/common/database/db";

@Injectable()
export class OrderService {
	@Inject(OrderRepository)
	private readonly orderRepository: OrderRepository;

	@Inject(ServiceService)
	private readonly serviceService: ServiceService;

	@Inject(WorkSkillService)
	private readonly workSkillService: WorkSkillService;

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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			throw new BadRequestException("获取订单列表失败: " + error.message);
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

			return order;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			throw new BadRequestException("获取订单详情失败: " + error.message);
		}
	}

	/**
	 * 创建普通订单
	 * @param createOrderDto 订单数据
	 * @returns 创建的订单信息
	 */
	async createOrder(createOrderDto: CreateOrder) {
		// 参数验证
		if (
			!createOrderDto.customerId ||
			!createOrderDto.serviceId ||
			!createOrderDto.addressId ||
			!createOrderDto.appointmentTime
		) {
			throw new BadRequestException("缺少必要参数");
		}

		// 验证预约时间是否合理
		if (createOrderDto.appointmentTime < new Date()) {
			throw new BadRequestException("预约时间不能是过去的时间");
		}

		try {
			// 获取服务基础信息
			const service = await this.serviceService.getServiceById(
				createOrderDto.serviceId,
			);

			if (!service) {
				throw new BadRequestException("服务不存在");
			}

			// 确定订单价格
			const price = service.basePrice;

			// 创建订单
			const result = await this.orderRepository.createOrder({
				...createOrderDto,
				originalAmount: parseFloat(price),
				discountAmount: createOrderDto.discountAmount
					? parseFloat(createOrderDto.discountAmount.toString())
					: 0,
				totalAmount: createOrderDto.discountAmount
					? parseFloat(price) -
						parseFloat(createOrderDto.discountAmount.toString())
					: parseFloat(price),
			});

			return result;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			throw new BadRequestException("创建订单失败: " + error.message);
		}
	}

	/**
	 * 创建用户指定服务人员的订单
	 */
	async createOrderWithDesignatedPersonnel(
		createOrderDto: CreateDesignatedOrder,
	) {
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
			throw new BadRequestException("服务人员当前不在工作状态");
		}

		// 4. 申请的服务时间是否在工作人员的工作时间内
		const { weekday, timeStr } = extractParams(createOrderDto.appointmentTime);

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

		// 5. 在相同的时间段中该工作人员是否有其他订单
		// 获取服务信息以计算服务时长
		const service = await this.serviceService.getServiceById(
			createOrderDto.serviceId,
		);
		if (!service) {
			throw new BadRequestException("服务不存在");
		}

		// 计算订单结束时间
		const appointmentStartTime = new Date(createOrderDto.appointmentTime);
		const estimatedDuration = service.estimatedDurationMinutes;
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

			// 获取该订单的服务信息
			const orderService = order.service;
			if (!orderService) {
				return false;
			}

			// 计算该订单的结束时间
			const orderStartTime = new Date(order.appointmentTime);
			const orderDuration = orderService.estimatedDurationMinutes;
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

		// 计算定价
		/**
		 * 定价计算方案
		 * 1. 以用户传入的其在应用中看到的价格为准
		 * 2. 同时校验最新的定价信息
		 * 3. 如果用户传入的定价和最新定价之间的差距在±30%之外，则触发警告，让用户刷新页面后重新下单
		 */
		const userPrice = createOrderDto.displayPrice; // 用户看到的价格
		const latestPrice = service.basePrice; // 最新定价

		// 计算价格差异百分比
		const priceDifference =
			Math.abs(userPrice - parseFloat(latestPrice)) / parseFloat(latestPrice);

		// 如果价格差异超过30%，则抛出异常
		if (priceDifference > 0.3) {
			throw new BadRequestException("价格已更新，请刷新页面后重新下单");
		}

		// 调用创建订单方法
		try {
			const result =
				await this.orderRepository.createOrderWithDesignatedPersonnel({
					customerId: createOrderDto.customerId,
					serviceId: createOrderDto.serviceId,
					addressId: createOrderDto.addressId,
					appointmentTime: createOrderDto.appointmentTime,
					discountAmount: createOrderDto.discountAmount.toString(),
					designatedPersonnelId: createOrderDto.designatedPersonnelId,
					price: userPrice.toString(), // 使用用户看到的价格
				});

			return {
				orderId: result.orderId,
			};
		} catch (error) {
			throw new BadRequestException(
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				"创建指定服务人员订单失败: " + error.message,
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
	async updateOrderStatus(id: string, newStatus: OrderStatus,{tx}:{tx?: DbType}) {
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			throw new BadRequestException("更新订单状态失败: " + error.message);
		}
	}
}
