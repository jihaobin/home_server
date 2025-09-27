import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
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
    VerifyOrderCheckinSchema,
    type VerifyOrderCheckinDto,
} from '@repo/types';
import { AuthGuard } from '../auth/auth.guard';


@ApiTags('订单模块')
@Controller('order')
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly orderCheckinService: OrderCheckinService,
    ) {}

    @UseGuards(AuthGuard)
    @Get(':id')
    @ApiOperation({
        summary: '获取订单详情',
        description: '返回订单基础信息并附带最新核验二维码',
    })
    async getOrderDetail(@Param('id') id: string, @Req() req: Request) {
        return await this.orderService.getOrderById(id, req.user.id,false);
    }

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
}


