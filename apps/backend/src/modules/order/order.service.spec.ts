import { BadRequestException } from '@nestjs/common';
import type { OrderRepository } from './order.reposityro';
import { OrderService } from './order.service';

jest.mock('sharp', () => jest.fn());

type MockOrderRepository = jest.Mocked<
    Pick<
        OrderRepository,
        | 'getOrderById'
        | 'hideOrderForCustomer'
        | 'hideOrderForStaff'
        | 'completeOrderAndIncrementServicedCount'
    >
>;

describe('OrderService order visibility', () => {
    let service: OrderService;
    let orderRepository: MockOrderRepository;

    beforeEach(() => {
        orderRepository = {
            getOrderById: jest.fn(),
            hideOrderForCustomer: jest.fn(),
            hideOrderForStaff: jest.fn(),
            completeOrderAndIncrementServicedCount: jest.fn(),
        };

        service = new OrderService({
            getTemplate: jest.fn(),
        } as any);
        Reflect.set(service, 'orderRepository', orderRepository);
        Reflect.set(service, 'payService', {
            handleOrderCompletion: jest.fn(),
        });
        Reflect.set(service, 'cacheService', {
            zRem: jest.fn().mockResolvedValue(0),
        });
    });

    it('用户隐藏订单时只标记当前客户的订单可见性', async () => {
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'completed',
        } as any);
        orderRepository.hideOrderForCustomer.mockResolvedValue(true);

        await expect(
            service.hideOrderForCustomer({
                orderId: 'order_1',
                customerId: 'customer_1',
            }),
        ).resolves.toEqual({ success: true });

        expect(orderRepository.hideOrderForCustomer).toHaveBeenCalledWith({
            orderId: 'order_1',
            customerId: 'customer_1',
        });
        expect(orderRepository.hideOrderForStaff).not.toHaveBeenCalled();
    });

    it('服务人员隐藏订单时只标记当前服务人员的分配可见性', async () => {
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'cancelled',
            assignment: {
                servicePersonnel: {
                    userId: 'staff_1',
                },
            },
        } as any);
        orderRepository.hideOrderForStaff.mockResolvedValue(true);

        await expect(
            service.hideOrderForStaff({
                orderId: 'order_1',
                staffId: 'staff_1',
            }),
        ).resolves.toEqual({ success: true });

        expect(orderRepository.hideOrderForStaff).toHaveBeenCalledWith({
            orderId: 'order_1',
            staffId: 'staff_1',
        });
        expect(orderRepository.hideOrderForCustomer).not.toHaveBeenCalled();
    });

    it('用户隐藏非本人订单时抛出权限错误', async () => {
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'completed',
        } as any);

        await expect(
            service.hideOrderForCustomer({
                orderId: 'order_1',
                customerId: 'other_customer',
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('服务人员隐藏非本人分配订单时抛出权限错误', async () => {
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'completed',
            assignment: {
                servicePersonnel: {
                    userId: 'staff_1',
                },
            },
        } as any);

        await expect(
            service.hideOrderForStaff({
                orderId: 'order_1',
                staffId: 'other_staff',
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('用户不能隐藏非终态订单', async () => {
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'paid',
        } as any);

        await expect(
            service.hideOrderForCustomer({
                orderId: 'order_1',
                customerId: 'customer_1',
            }),
        ).rejects.toThrow('只有已结束的订单才能删除');

        expect(orderRepository.hideOrderForCustomer).not.toHaveBeenCalled();
    });

    it('服务人员不能隐藏非终态订单', async () => {
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'paid',
            assignment: {
                servicePersonnel: {
                    userId: 'staff_1',
                },
            },
        } as any);

        await expect(
            service.hideOrderForStaff({
                orderId: 'order_1',
                staffId: 'staff_1',
            }),
        ).rejects.toThrow('只有已结束的订单才能删除');

        expect(orderRepository.hideOrderForStaff).not.toHaveBeenCalled();
    });

    it('完成确认允许 paid 订单直接进入 completed 并触发收益处理', async () => {
        const paidOrder = {
            id: 'order_1',
            customerId: 'customer_1',
            status: 'paid',
            appointmentTime: new Date('2026-05-01T10:00:00.000Z'),
            assignment: {
                id: 'assignment_1',
                servicePersonnel: {
                    userId: 'staff_1',
                },
            },
        };
        const completedOrder = {
            ...paidOrder,
            status: 'completed',
            serviceCompletedAt: new Date('2026-05-01T11:00:00.000Z'),
        };
        const payService = Reflect.get(service, 'payService') as {
            handleOrderCompletion: jest.Mock;
        };

        orderRepository.getOrderById.mockResolvedValue(paidOrder as any);
        orderRepository.completeOrderAndIncrementServicedCount.mockResolvedValue(
            completedOrder as any,
        );

        await expect(
            service.completeOrder('order_1', 'customer_1'),
        ).resolves.toEqual(completedOrder);

        expect(
            orderRepository.completeOrderAndIncrementServicedCount,
        ).toHaveBeenCalledWith('order_1');
        expect(payService.handleOrderCompletion).toHaveBeenCalledTimes(1);
        expect(payService.handleOrderCompletion).toHaveBeenCalledWith(
            'order_1',
        );
    });

    it('完成确认拒绝非 paid 订单，避免重复完成副作用', async () => {
        const payService = Reflect.get(service, 'payService') as {
            handleOrderCompletion: jest.Mock;
        };
        orderRepository.getOrderById.mockResolvedValue({
            id: 'order_1',
            customerId: 'customer_1',
            status: 'completed',
        } as any);

        await expect(
            service.completeOrder('order_1', 'customer_1'),
        ).rejects.toThrow('订单必须处于待服务状态才能完成确认');

        expect(
            orderRepository.completeOrderAndIncrementServicedCount,
        ).not.toHaveBeenCalled();
        expect(payService.handleOrderCompletion).not.toHaveBeenCalled();
    });
});
