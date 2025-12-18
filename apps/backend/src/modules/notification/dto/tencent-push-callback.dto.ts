import { z } from 'zod';

const sdkAppIdSchema = z.preprocess((value) => {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string' && value.trim().length) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
}, z.number('SdkAppid 不能为空').int());

export const TencentPushCallbackQuerySchema = z.looseObject({
    SdkAppid: sdkAppIdSchema,
    CallbackCommand: z.literal('Push.AllMemberPush'),
    contenttype: z.string().optional(),
});

export type TencentPushCallbackQueryDto = z.infer<
    typeof TencentPushCallbackQuerySchema
>;

export const TencentPushCallbackEventSchema = z.looseObject({
    CallbackCommand: z.literal('Push.AllMemberPush'),
    EventType: z.number().int(),
    TaskId: z.string().optional(),
    TaskTime: z.number().int().optional(),
    EventTime: z.number().int().optional(),
    To_Account: z.string().min(1, 'To_Account 不能为空'),
    PushPlatform: z.number().int().optional(),
    DeviceType: z.number().int().optional(),
    PushStage: z.number().int().optional(),
    ErrCode: z.number().int(),
    ErrInfo: z.string().nullable().optional(),
    DataId: z.string().min(1, 'DataId 不能为空').optional(),
});

export type TencentPushCallbackEventDto = z.infer<
    typeof TencentPushCallbackEventSchema
>;

export const TencentPushCallbackBodySchema = z.looseObject({
    Events: z
        .array(TencentPushCallbackEventSchema)
        .min(1, 'Events 不能为空')
        .max(100, '单次回调最多包含 100 个事件'),
});

export type TencentPushCallbackBodyDto = z.infer<
    typeof TencentPushCallbackBodySchema
>;
