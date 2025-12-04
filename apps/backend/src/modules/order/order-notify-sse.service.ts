import { Injectable, type MessageEvent } from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';

export interface OrderNotificationPayload {
    event: string;
    orderId: string;
    status?: string;
    message?: string;
    triggeredAt?: string;
    decisionStatus?: string;
    operatorId?: string;
}

@Injectable()
export class OrderNotifySseService {
    private readonly subject = new Subject<OrderNotificationPayload>();

    emit(payload: OrderNotificationPayload) {
        this.subject.next(payload);
    }

    stream(): Observable<MessageEvent> {
        return this.subject
            .asObservable()
            .pipe(map((payload): MessageEvent => ({ data: payload })));
    }
}
