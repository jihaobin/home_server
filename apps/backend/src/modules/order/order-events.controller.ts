import { Controller, Sse, type MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OrderNotifySseService } from './order-notify-sse.service';

@Controller('orders')
export class OrderEventsController {
    constructor(
        private readonly orderNotifySseService: OrderNotifySseService,
    ) {}

    @Sse('events')
    stream(): Observable<MessageEvent> {
        return this.orderNotifySseService.stream();
    }
}
