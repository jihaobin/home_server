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
    HomeSearchQuerySchema,
    HomeSearchResponseSchema,
    HomeSearchSuggestionsQuerySchema,
    HomeSearchSuggestionResponseSchema,
    serviceCategoriesSchema,
    type HomeQuery,
    type HomeSearchQuery,
    type HomeSearchSuggestionsQuery,
    type ServiceCategoryTree,
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
import { z } from 'zod/v4';

const HomeQueryWithCategorySchema = HomeQuerySchema.extend({
    categoryId: z.string().max(255).optional().meta({
        title: '分类ID',
        description: '可选；用于按服务分类过滤推荐人员列表',
    }),
});

type HomeQueryWithCategoryId = HomeQuery & {
    categoryId?: string;
};

const HomeMoreServicesResponseSchema = z
    .object({
        categories: z.array(serviceCategoriesSchema) as unknown as z.ZodType<
            ServiceCategoryTree[]
        >,
    })
    .meta({
        title: '首页更多服务弹层响应',
        description: '首页“更多服务”弹出层：全量分类 + 分类下服务列表',
    });

@ApiTags('首页')
@Controller('home')
export class HomeController {
    constructor(private readonly homeService: HomeService) {}

    @UseGuards(AuthGuard)
    @Get()
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(HomeQueryWithCategorySchema))
    @ApiOperation({
        summary: '用户端首页聚合数据',
        description: '一次性返回首页渲染所需数据（运营位 + 分类 + 推荐列表）',
    })
    @ApiQueries(HomeQueryWithCategorySchema)
    @ApiSuccessResponse(HomeResponseSchema)
    @ApiErrorResponses()
    async getHome(
        @Query() query: HomeQueryWithCategoryId,
        @Req() req: Request,
    ) {
        return await this.homeService.getHome(req.user?.id, query);
    }

    @UseGuards(AuthGuard)
    @Get('search/suggestions')
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(HomeSearchSuggestionsQuerySchema))
    @ApiOperation({
        summary: '用户端首页搜索候选词',
        description: '返回移动端搜索页输入联想所需的轻量候选词数据',
    })
    @ApiQueries(HomeSearchSuggestionsQuerySchema)
    @ApiSuccessResponse(HomeSearchSuggestionResponseSchema)
    @ApiErrorResponses()
    async getHomeSearchSuggestions(@Query() query: HomeSearchSuggestionsQuery) {
        return await this.homeService.searchSuggestions(query);
    }

    @UseGuards(AuthGuard)
    @Get('search')
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(HomeSearchQuerySchema))
    @ApiOperation({
        summary: '用户端首页搜索结果',
        description: '返回移动端搜索结果页统一搜索结果，由后端决定渲染模式',
    })
    @ApiQueries(HomeSearchQuerySchema)
    @ApiSuccessResponse(HomeSearchResponseSchema)
    @ApiErrorResponses()
    async searchHome(@Query() query: HomeSearchQuery, @Req() req: Request) {
        return await this.homeService.search(req.user?.id, query);
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
    @Get('more-services')
    @Public()
    @ApiOperation({
        summary: '用户端首页更多服务弹层数据',
        description: '返回弹出层所需的全量分类与分类下服务列表数据',
    })
    @ApiSuccessResponse(HomeMoreServicesResponseSchema)
    @ApiErrorResponses()
    async getHomeMoreServices() {
        return await this.homeService.getHomeMoreServices();
    }

    @UseGuards(AuthGuard)
    @Get('recommendations')
    @AuthOptional()
    @UsePipes(new ZodValidationPipe(HomeQueryWithCategorySchema))
    @ApiOperation({
        summary: '用户端首页推荐列表',
        description:
            '返回首页推荐服务人员卡片数据；未传入坐标时不做位置过滤，按评分等规则排序',
    })
    @ApiQueries(HomeQueryWithCategorySchema)
    @ApiSuccessResponse(HomeRecommendationsResponseSchema)
    @ApiErrorResponses()
    async getHomeRecommendations(
        @Query() query: HomeQueryWithCategoryId,
        @Req() req: Request,
    ) {
        return await this.homeService.getHomeRecommendations(
            req.user?.id,
            query,
        );
    }
}
