import { z } from 'zod/v4';

export const AliyunVoiceReportSchema = z.object({
    call_id: z.string().trim().min(1).optional(),
    out_id: z.string().trim().min(1).optional(),
    request_id: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    status_code: z.string().trim().min(1).optional(),
    status_msg: z.string().trim().min(1).optional(),
    smart_status: z.string().trim().min(1).optional(),
    smart_status_code: z.string().trim().min(1).optional(),
    duration: z.union([z.string(), z.number()]).optional(),
    called_number: z.string().trim().min(1).optional(),
    template_code: z.string().trim().min(1).optional(),
    voice_code: z.string().trim().min(1).optional(),
    start_time: z.string().trim().min(1).optional(),
    end_time: z.string().trim().min(1).optional(),
    hangup_time: z.string().trim().min(1).optional(),
    dtmf: z.string().trim().min(1).optional(),
});

export const AliyunVoiceCallbackPayloadSchema = z.union([
    AliyunVoiceReportSchema,
    z.array(AliyunVoiceReportSchema),
]);

export type AliyunVoiceReportDto = z.infer<typeof AliyunVoiceReportSchema>;
