import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PersonnelFavoriteSummaryResponseSchema } from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthOptional } from '../auth/decorators';
import { FollowService } from './follow.service';

@ApiTags('收藏')
@Controller('follows')
export class FollowController {
    constructor(private readonly followService: FollowService) {}

    @UseGuards(AuthGuard)
    @Get('personnel/:personnelId/summary')
    @AuthOptional()
    @ApiOperation({
        summary: '获取服务人员收藏读态',
        description: '返回服务人员收藏总数与当前用户收藏状态',
    })
    @ApiParam({ name: 'personnelId', description: '服务人员 ID' })
    @ApiSuccessResponse(PersonnelFavoriteSummaryResponseSchema)
    @ApiErrorResponses()
    async getPersonnelFavoriteSummary(
        @Param('personnelId') personnelId: string,
        @Req() req: Request,
    ) {
        return await this.followService.getPersonnelFavoriteSummary(
            personnelId,
            req.user?.id,
        );
    }
}
