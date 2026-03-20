import { z } from 'zod';

export const VoiceCallTtsRequestSchema = z.object({
    calledNumber: z.string().trim().min(1, 'calledNumber 不能为空').max(32),
    ttsCode: z.string().trim().min(1, 'ttsCode 不能为空').max(128),
    calledShowNumber: z.string().trim().min(1).max(32).optional(),
    outId: z.string().trim().min(1).max(64).optional(),
    ttsParam: z
        .record(z.string(), z.union([z.string(), z.number()]))
        .optional(),
});

export const VoiceCallTtsResponseSchema = z.object({
    success: z.boolean(),
    callId: z.string().optional(),
    requestId: z.string().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
    outId: z.string().optional(),
    error: z.string().optional(),
    recommend: z.string().optional(),
});

export type VoiceCallTtsRequestDto = z.infer<typeof VoiceCallTtsRequestSchema>;
export type VoiceCallTtsResponseDto = z.infer<
    typeof VoiceCallTtsResponseSchema
>;
