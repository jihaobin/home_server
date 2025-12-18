import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
    NotificationAckSchema,
    NotificationHeartbeatSchema,
    type NotificationAckDto,
    type NotificationHeartbeatDto,
} from '@repo/types';
import { ZodValidationPipe } from 'src/common/pipes';

import { AuthGuard } from '../auth/auth.guard';
import { Public, Roles } from '../auth/decorators';
import { NotificationClientService } from './notification-client.service';
import { NotificationMetricsService } from './notification-metrics.service';

@ApiTags('通知')
@Controller('notifications')
export class NotificationController {
    constructor(
        private readonly notificationClientService: NotificationClientService,
        private readonly notificationMetricsService: NotificationMetricsService,
    ) {}

    @Public()
    @Get('metrics')
    async metrics(@Res() res: Response) {
        const payload =
            await this.notificationMetricsService.getMetricsSnapshot();
        res.setHeader(
            'Content-Type',
            this.notificationMetricsService.getContentType(),
        );
        return res.send(payload);
    }

    @Post('heartbeat')
    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @UsePipes(new ZodValidationPipe(NotificationHeartbeatSchema))
    @ApiOperation({
        summary: '通知心跳上报',
        description: '客户端周期性调用，标记服务人员在线状态',
    })
    async heartbeat(
        @Req() req: Request,
        @Body() dto: NotificationHeartbeatDto,
    ) {
        await this.notificationClientService.recordHeartbeat(req.user.id, dto);
        return { acknowledged: true };
    }

    @Post('ack')
    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @UsePipes(new ZodValidationPipe(NotificationAckSchema))
    @ApiOperation({
        summary: '通知 ACK',
        description: 'strict 通知送达后调用，更新投递记录 ack 状态',
    })
    async ack(@Req() req: Request, @Body() dto: NotificationAckDto) {
        await this.notificationClientService.ackDelivery(req.user.id, dto);
        return { acknowledged: true };
    }
}
