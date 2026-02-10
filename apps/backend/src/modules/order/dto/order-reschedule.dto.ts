import { z } from 'zod/v4';

export const OrderRescheduleSchema = z
    .object({
        appointmentTime: z.iso.datetime({ offset: true, local: true }).meta({
            title: '预约窗口起点',
            description:
                '2 小时服务到达窗口的起始时间点（slot start），ISO datetime。',
        }),
    })
    .meta({
        title: '服务人员改期',
        description: '服务人员将订单预约时间改为新的 2 小时窗口起点。',
    });

export type OrderRescheduleDto = z.infer<typeof OrderRescheduleSchema>;
