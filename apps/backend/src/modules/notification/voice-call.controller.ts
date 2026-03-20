import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { VoiceCallService } from 'src/common/voice';
import { createZodPipe } from 'src/common/pipes';

import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import {
    VoiceCallTtsRequestSchema,
    VoiceCallTtsResponseSchema,
    type VoiceCallTtsRequestDto,
} from './dto/voice-call.dto';

@ApiTags('通知')
@Controller('notifications/voice')
export class VoiceCallController {
    constructor(private readonly voiceCallService: VoiceCallService) {}

    @Post('tts')
    @ApiOperation({
        summary: '发起阿里云 TTS 语音通话',
        description:
            '向指定手机号发起阿里云语音通知。默认使用 STS 临时凭证，也支持切换为阿里云默认凭据链。',
    })
    @UsePipes(createZodPipe(VoiceCallTtsRequestSchema, '语音通话参数校验失败'))
    @ApiBodies(VoiceCallTtsRequestSchema)
    @ApiSuccessResponse(VoiceCallTtsResponseSchema, {
        description: '返回阿里云语音通话发起结果',
    })
    @ApiErrorResponses()
    singleCallByTts(@Body() payload: VoiceCallTtsRequestDto) {
        return this.voiceCallService.singleCallByTts(payload);
    }
}
