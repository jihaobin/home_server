import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { ZodValidationPipe } from 'src/common/pipes';
import { OrderService } from './order.service';
import { OrderCheckinService } from './order-checkin.service';
import {
    CreateDesignatedOrder,
    CreateDesignatedOrderSchema,
    OrderListRequestSchema,
    OrderListResponseSchema,
    OrderCardsListQuerySchema,
    OrderCardsListResponseSchema,
    StaffOrderListRequestSchema,
    StaffOrderListResponseSchema,
    VerifyOrderCheckinSchema,
    type UserRole,
    type VerifyOrderCheckinDto,
} from '@repo/types';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';

@ApiTags('订单模块')
@Controller('order')
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly orderCheckinService: OrderCheckinService,
    ) {}

    @UseGuards(AuthGuard)
    @Roles(['customer'])
    @Get()
    @UsePipes(
        new ZodValidationPipe(
            OrderListRequestSchema.omit({ customerId: true }),
        ),
    )
    @ApiQueries(OrderListRequestSchema.omit({ customerId: true }))
    @ApiSuccessResponse(OrderListResponseSchema, {
        description: '成功返回结果',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '获取客户订单列表',
        description: '根据客户ID和其他筛选条件获取订单列表',
    })
    async getOrdersByCustomerId(@Query() query: any, @Req() req: Request) {
        const params = {
            ...query,
            customerId: req.user.id,
            page: query.page ? parseInt(query.page as string) : undefined,
            limit: query.limit ? parseInt(query.limit as string) : undefined,
            startTime: query.startTime
                ? new Date(query.startTime as string)
                : undefined,
            endTime: query.endTime
                ? new Date(query.endTime as string)
                : undefined,
        };

        return await this.orderService.getOrdersByCustomerId(params);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('assignments/me')
    @UsePipes(
        new ZodValidationPipe(
            StaffOrderListRequestSchema.omit({ servicePersonnelId: true }),
        ),
    )
    @ApiQueries(StaffOrderListRequestSchema.omit({ servicePersonnelId: true }))
    @ApiSuccessResponse(StaffOrderListResponseSchema, {
        description: '返回服务人员自己的订单列表',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '获取服务人员的订单列表',
        description: '服务人员查看自己的订单与筛选条件',
    })
    async getOrdersByStaff(@Query() query: any, @Req() req: Request) {
        const params = {
            ...query,
            servicePersonnelId: req.user.id,
            page: query.page ? parseInt(query.page as string) : undefined,
            limit: query.limit ? parseInt(query.limit as string) : undefined,
            startTime: query.startTime
                ? new Date(query.startTime as string)
                : undefined,
            endTime: query.endTime
                ? new Date(query.endTime as string)
                : undefined,
        };

        return await this.orderService.getOrdersByStaff(params);
    }

    @UseGuards(AuthGuard)
    @Roles(['customer'])
    @Get('cards')
    @UsePipes(new ZodValidationPipe(OrderCardsListQuerySchema))
    @ApiQueries(OrderCardsListQuerySchema)
    @ApiSuccessResponse(OrderCardsListResponseSchema, {
        description: '成功返回用户端订单卡片列表',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '获取用户端订单卡片列表',
        description: '仅用于移动端用户订单列表页（tabs）',
    })
    async getOrderCards(@Query() query: any, @Req() req: Request) {
        // ZodValidationPipe 已对 query 做了 auto-transform；这里直接使用即可。
        return await this.orderService.getOrderCardsByCustomerId({
            customerId: req.user.id,
            tab: query.tab,
            page: query.page,
            limit: query.limit,
        });
    }

    @UseGuards(AuthGuard)
    @Roles(['customer', 'service_personnel'])
    @Get(':id')
    @ApiOperation({
        summary: '获取订单详情',
        description: '获取订单详情信息，用户和服务人员均可访问',
    })
    async getOrderDetail(@Param('id') id: string, @Req() req: Request) {
        return await this.orderService.getOrderById(id, req.user.id);
    }

    @UseGuards(AuthGuard)
    @Roles(['customer'])
    @Get(':id/check-in')
    @ApiOperation({
        summary: '生成订单核验二维码',
        description: '当前用户拉取订单详情时生成新的核验二维码',
    })
    async getOrderCheckin(@Param('id') id: string, @Req() req: Request) {
        return await this.orderCheckinService.generateQrCode({
            orderId: id,
            requesterId: req.user.id,
        });
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post('check-in/verify')
    @UsePipes(new ZodValidationPipe(VerifyOrderCheckinSchema))
    @ApiOperation({
        summary: '核验服务人员到场',
        description: '服务人员扫码后提交校验，校验通过即视为到场',
    })
    @ApiBodies(VerifyOrderCheckinSchema)
    async verifyCheckIn(
        @Body() dto: VerifyOrderCheckinDto,
        @Req() req: Request,
    ) {
        const staffId = req.user.id;
        if (!staffId) {
            throw new BadRequestException('缺少服务人员身份信息');
        }

        return await this.orderCheckinService.verifyCheckIn({
            ...dto,
            staffId,
        });
    }

    @UseGuards(AuthGuard)
    @Roles(['customer'])
    @Post('createWithDesignatedPersonnel')
    @UsePipes(new ZodValidationPipe(CreateDesignatedOrderSchema))
    @ApiOperation({
        summary: '生成用户指定服务人员的订单',
        description: '用户指定服务人员并下单',
    })
    @ApiBodies(CreateDesignatedOrderSchema)
    // @ApiSuccessResponse(, {
    //     description: '成功返回结果',
    // })
    async createOrderWithDesignatedPersonnel(
        @Body() createOrderDto: CreateDesignatedOrder,
    ) {
        return await this.orderService.createOrderWithDesignatedPersonnel(
            createOrderDto,
        );
    }

    @UseGuards(AuthGuard)
    @Roles(['customer', 'service_personnel'])
    @Post(':id/cancel')
    @ApiOperation({
        summary: '取消订单',
        description: '用户或服务人员取消订单，需要提供取消原因',
    })
    async cancelOrder(
        @Param('id') id: string,
        @Body('reason') reason: string,
        @Req() req: Request,
    ) {
        const userId = req.user.id;
        const actorRole = this.resolveUserRole(req.user.role);
        // 验证是否有权限取消订单
        const order = await this.orderService.getOrderById(id, userId);

        // 可以取消的条件：用户是订单创建者，或是分配的服务人员
        if (order.customerId !== userId) {
            // 检查是否为分配的服务人员
            const assignment = order.assignment;
            if (!assignment || assignment.servicePersonnel?.userId !== userId) {
                throw new BadRequestException('无权限取消此订单');
            }
        }

        return await this.orderService.cancelOrder({
            id,
            reason,
            actorId: userId,
            actorRole,
        });
    }

    @UseGuards(AuthGuard)
    @Roles(['customer'])
    @Post(':id/complete')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: '完成订单',
        description: '服务人员将订单状态更新为已完成',
    })
    async completeOrder(@Param('id') id: string, @Req() req: Request) {
        const userId = req.user.id;
        // 验证是否有权限完成订单（必须是订单发起者）
        const order = await this.orderService.getOrderById(id, userId);

        // 只有订单的发起者（用户）才能完成订单
        if (order.customerId !== userId) {
            throw new BadRequestException('只有订单发起者才能完成此订单');
        }

        return await this.orderService.completeOrder(id);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post(':id/accept')
    @ApiOperation({
        summary: '服务人员接单',
        description: '当前登录的服务人员确认接单',
    })
    async acceptAssignment(@Param('id') id: string, @Req() req: Request) {
        const staffId = req.user.id;
        return await this.orderService.acceptAssignment(id, staffId);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post(':id/reject')
    @ApiOperation({
        summary: '服务人员拒绝接单',
        description: '当前登录的服务人员拒绝接单并填写原因',
    })
    async rejectAssignment(
        @Param('id') id: string,
        @Body('reason') reason: string,
        @Req() req: Request,
    ) {
        const staffId = req.user.id;
        return await this.orderService.rejectAssignment(id, staffId, reason);
    }

    private resolveUserRole(rawRole: string | string[] | undefined): UserRole {
        if (Array.isArray(rawRole)) {
            return rawRole.includes('service_personnel')
                ? 'service_personnel'
                : 'customer';
        }

        if (typeof rawRole === 'string') {
            const roles = rawRole
                .split(',')
                .map((role) => role.trim())
                .filter(Boolean);
            return roles.includes('service_personnel')
                ? 'service_personnel'
                : 'customer';
        }

        return 'customer';
    }
}
