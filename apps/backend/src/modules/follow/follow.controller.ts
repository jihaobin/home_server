import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    FavoritePersonnelListResponseSchema,
    ListFavoritePersonnelQuerySchema,
    PersonnelFavoriteMutationResponseSchema,
    PersonnelFavoriteSummaryResponseSchema,
    type ListFavoritePersonnelQuery,
} from '@repo/types';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';
import type { Request } from 'express';
import { ZodValidationPipe } from 'src/common/pipes';
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

    @UseGuards(AuthGuard)
    @Post('personnel/:personnelId')
    @ApiOperation({
        summary: '收藏服务人员',
        description: '当前登录用户收藏指定服务人员，重复收藏幂等成功',
    })
    @ApiParam({ name: 'personnelId', description: '服务人员 ID' })
    @ApiSuccessResponse(PersonnelFavoriteMutationResponseSchema)
    @ApiErrorResponses()
    async favoritePersonnel(
        @Param('personnelId') personnelId: string,
        @Req() req: Request,
    ) {
        return await this.followService.favoritePersonnel(
            req.user.id,
            personnelId,
        );
    }

    @UseGuards(AuthGuard)
    @Delete('personnel/:personnelId')
    @ApiOperation({
        summary: '取消收藏服务人员',
        description: '当前登录用户取消收藏指定服务人员，重复取消幂等成功',
    })
    @ApiParam({ name: 'personnelId', description: '服务人员 ID' })
    @ApiSuccessResponse(PersonnelFavoriteMutationResponseSchema)
    @ApiErrorResponses()
    async unfavoritePersonnel(
        @Param('personnelId') personnelId: string,
        @Req() req: Request,
    ) {
        return await this.followService.unfavoritePersonnel(
            req.user.id,
            personnelId,
        );
    }

    @UseGuards(AuthGuard)
    @Get('personnel')
    @UsePipes(new ZodValidationPipe(ListFavoritePersonnelQuerySchema))
    @ApiOperation({
        summary: '获取我的收藏服务人员列表',
        description: '返回当前登录用户收藏的服务人员分页列表',
    })
    @ApiQueries(ListFavoritePersonnelQuerySchema)
    @ApiSuccessResponse(FavoritePersonnelListResponseSchema)
    @ApiErrorResponses()
    async listFavoritePersonnel(
        @Query() query: ListFavoritePersonnelQuery,
        @Req() req: Request,
    ) {
        return await this.followService.listFavoritePersonnel(
            req.user.id,
            query,
        );
    }
}
