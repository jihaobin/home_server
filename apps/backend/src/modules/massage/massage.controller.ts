import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    MassageLandingQuerySchema,
    MassageLandingResponseSchema,
    MassagePersonnelDetailQuerySchema,
    MassagePersonnelDetailResponseSchema,
    type MassageLandingQuery,
    type MassagePersonnelDetailQuery,
} from '@repo/types';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';
import { createMultiZodPipe, ZodValidationPipe } from 'src/common/pipes';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthOptional } from '../auth/decorators';
import { MassageService } from './massage.service';
import { z } from 'zod/v4';

@ApiTags('按摩频道')
@Controller('massage')
export class MassageController {
    constructor(private readonly massageService: MassageService) {}

    @UseGuards(AuthGuard)
    @Get('landing')
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(MassageLandingQuerySchema))
    @ApiOperation({
        summary: '获取按摩频道 landing 数据',
        description: '返回按摩频道 banner、服务标签入口和聚合服务人员',
    })
    @ApiQueries(MassageLandingQuerySchema)
    @ApiSuccessResponse(MassageLandingResponseSchema)
    @ApiErrorResponses()
    async getLanding(@Query() query: MassageLandingQuery, @Req() req: Request) {
        return await this.massageService.getLanding(req.user?.id, query);
    }

    @UseGuards(AuthGuard)
    @Get('personnel/:personnelId')
    @AuthOptional()
    @UsePipes(
        createMultiZodPipe({
            params: z.string().max(255).min(1, '服务人员ID不能为空').meta({
                title: '服务人员ID',
                description: '按摩详情接口路径参数',
            }),
            query: MassagePersonnelDetailQuerySchema,
            errorMessage: '按摩详情参数校验失败',
        }),
    )
    @ApiOperation({
        summary: '获取按摩频道服务人员详情',
        description: '返回按摩频道详情页所需的服务人员聚合数据',
    })
    @ApiParam({ name: 'personnelId', description: '服务人员 ID' })
    @ApiQueries(MassagePersonnelDetailQuerySchema)
    @ApiSuccessResponse(MassagePersonnelDetailResponseSchema)
    @ApiErrorResponses()
    async getPersonnelDetail(
        @Param('personnelId') personnelId: string,
        @Query() query: MassagePersonnelDetailQuery,
        @Req() req: Request,
    ) {
        return await this.massageService.getPersonnelDetail(
            req.user?.id,
            personnelId,
            query,
        );
    }
}
