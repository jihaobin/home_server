import {
    Controller,
    Get,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    HomeQuerySchema,
    HomeBaseResponseSchema,
    HomeRecommendationsResponseSchema,
    HomeResponseSchema,
    type HomeQuery,
} from '@repo/types';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { AuthOptional, Public } from '../auth/decorators';
import { HomeService } from './home.service';

@ApiTags('首页')
@Controller('home')
export class HomeController {
    constructor(private readonly homeService: HomeService) {}

    @UseGuards(AuthGuard)
    @Get()
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(HomeQuerySchema))
    @ApiOperation({
        summary: '用户端首页聚合数据',
        description: '一次性返回首页渲染所需数据（运营位 + 分类 + 推荐列表）',
    })
    @ApiQueries(HomeQuerySchema)
    @ApiSuccessResponse(HomeResponseSchema)
    @ApiErrorResponses()
    async getHome(@Query() query: HomeQuery, @Req() req: Request) {
        return await this.homeService.getHome(req.user?.id, query);
    }

    @UseGuards(AuthGuard)
    @Get('base')
    @Public()
    @ApiOperation({
        summary: '用户端首页基础数据',
        description:
            '返回首页基础渲染所需数据（运营位 + 分类），不包含推荐列表',
    })
    @ApiSuccessResponse(HomeBaseResponseSchema)
    @ApiErrorResponses()
    async getHomeBase() {
        return await this.homeService.getHomeBase();
    }

    @UseGuards(AuthGuard)
    @Get('recommendations')
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(HomeQuerySchema))
    @ApiOperation({
        summary: '用户端首页推荐列表',
        description:
            '返回首页推荐服务人员卡片数据；未传入坐标时不做位置过滤，按评分等规则排序',
    })
    @ApiQueries(HomeQuerySchema)
    @ApiSuccessResponse(HomeRecommendationsResponseSchema)
    @ApiErrorResponses()
    async getHomeRecommendations(@Query() query: HomeQuery) {
        return await this.homeService.getHomeRecommendations(query);
    }
}
