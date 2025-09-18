import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { ZodValidationPipe } from 'src/common/pipes';
import {
    CreateDesignatedOrder,
    CreateDesignatedOrderSchema,
} from '@repo/types';

@ApiTags('订单模块')
@Controller('order')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post('createWithDesignatedPersonnel')
    @UsePipes(new ZodValidationPipe(CreateDesignatedOrderSchema))
    @ApiOperation({
        summary: '创建用户指定服务人员的订单',
        description: '用户指定服务人员创建订单',
    })
    @ApiBodies(CreateDesignatedOrderSchema)
    // @ApiSuccessResponse(, {
    //     description: '成功创建订单',
    // })
    async createOrderWithDesignatedPersonnel(
        @Body() createOrderDto: CreateDesignatedOrder,
    ) {
        return await this.orderService.createOrderWithDesignatedPersonnel(
            createOrderDto,
        );
    }
}
