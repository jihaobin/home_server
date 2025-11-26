import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminBulkUpdateOrderStatusSchema,
    AdminBulkUpdateOrderStatusResultSchema,
    AdminOrderListItemSchema,
    AdminOrderListQuerySchema,
    AdminUpdateOrderStatusSchema,
    OrderDetailSchema,
    type AdminBulkUpdateOrderStatus,
    type AdminOrderListQuery,
    type AdminUpdateOrderStatus,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminOrdersService } from './admin-orders.service';

@ApiTags('管理员订单')
@Controller('admin/orders')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminOrdersController {
    constructor(private readonly adminOrdersService: AdminOrdersService) {}

    @Get()
    @ApiOperation({
        summary: '分页查询订单',
        description:
            '支持按订单编号、用户/服务人员、状态、时间与金额区间筛选。',
    })
    @ApiSuccessResponse(AdminOrderListItemSchema, {
        isPaginated: true,
        description: '订单分页数据',
    })
    @ApiErrorResponses()
    listOrders(
        @Query(new ZodValidationPipe(AdminOrderListQuerySchema))
        query: AdminOrderListQuery,
    ) {
        return this.adminOrdersService.listOrders(query);
    }

    @Get(':id')
    @ApiOperation({
        summary: '查看订单详情',
        description: '返回订单基础信息、支付记录、服务地址等详情。',
    })
    @ApiSuccessResponse(OrderDetailSchema, {
        description: '订单详情数据',
    })
    @ApiErrorResponses()
    getOrderDetail(@Param('id') orderId: string) {
        return this.adminOrdersService.getOrderDetail(orderId);
    }

    @Patch(':id/status')
    @ApiOperation({
        summary: '更新订单状态',
        description: '支持将订单流转到允许的下一个状态。',
    })
    @ApiSuccessResponse(OrderDetailSchema, {
        description: '更新后的订单详情',
    })
    @ApiErrorResponses()
    updateOrderStatus(
        @Param('id') orderId: string,
        @Body(new ZodValidationPipe(AdminUpdateOrderStatusSchema))
        payload: AdminUpdateOrderStatus,
    ) {
        return this.adminOrdersService.updateOrderStatus(orderId, payload);
    }

    @Patch('status/bulk')
    @ApiOperation({
        summary: '批量更新订单状态',
        description: '用于批量标记订单状态，例如批量完成或批量取消。',
    })
    @ApiSuccessResponse(AdminBulkUpdateOrderStatusResultSchema, {
        description: '批量更新结果',
    })
    @ApiErrorResponses()
    bulkUpdateStatus(
        @Body(new ZodValidationPipe(AdminBulkUpdateOrderStatusSchema))
        payload: AdminBulkUpdateOrderStatus,
    ) {
        return this.adminOrdersService.bulkUpdateOrderStatus(payload);
    }
}
