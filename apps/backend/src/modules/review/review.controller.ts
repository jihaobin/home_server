import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ZodValidationPipe } from 'src/common/pipes';
import { ReviewService } from './review.service';
import {
    CreateReviewBodySchema,
    CreateReviewResponseSchema,
    ReviewerTargetsQuerySchema,
    ReviewerTargetsResponseSchema,
    ReviewStatsSchema,
    TargetReviewsQuerySchema,
    TargetReviewsResponseSchema,
    type CreateReviewBody,
    type ReviewerTargetsQuery,
    type TargetReviewsQuery,
    ReviewTargetTypeEnum,
    type ReviewStats,
    type CreateReviewResponse,
} from '@repo/types';
import { AuthGuard } from '../auth/auth.guard';
import {
    ApiErrorResponses,
    ApiQueries,
    ApiSuccessResponse,
} from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';

@ApiTags('评价模块')
@Controller('review')
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) {}

    @UseGuards(AuthGuard)
    @Post()
    @UsePipes(new ZodValidationPipe(CreateReviewBodySchema))
    @ApiBodies(CreateReviewBodySchema)
    @ApiSuccessResponse(CreateReviewResponseSchema, {
        description: '成功创建评价',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '创建订单评价',
        description: '对已完成的订单进行评价',
    })
    async createReview(@Body() body: CreateReviewBody, @Req() req: Request) {
        return await this.reviewService.createReview(body, req.user.id);
    }

    @UseGuards(AuthGuard)
    @Get('targets')
    @ApiQueries(ReviewerTargetsQuerySchema)
    @ApiSuccessResponse(ReviewerTargetsResponseSchema, {
        description: '成功获取已评价对象列表',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '查看用户已评价对象列表',
        description: '获取当前用户已评价的对象列表（按对象分组）',
    })
    async getReviewerTargets(
        @Query(new ZodValidationPipe(ReviewerTargetsQuerySchema))
        query: ReviewerTargetsQuery,
        @Req() req: Request,
    ) {
        // 处理查询参数类型转换
        const params: ReviewerTargetsQuery = {
            page: query.page ? Number(query.page) : 1,
            limit: query.limit ? Number(query.limit) : 10,
            targetType: query.targetType,
        };

        return await this.reviewService.getReviewerTargets(params, req.user.id);
    }

    @UseGuards(AuthGuard)
    @Get('order/:orderId')
    @ApiSuccessResponse(CreateReviewResponseSchema, {
        description: '成功获取订单评价',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '查看用户针对某个订单的评价',
        description: '获取当前用户对某个订单的评价详情',
    })
    async getReviewByOrder(
        @Param('orderId') orderId: string,
        @Req() req: Request,
    ): Promise<CreateReviewResponse> {
        const review = await this.reviewService.getReviewByOrder(
            orderId,
            req.user.id,
        );
        if (!review) {
            throw new NotFoundException('未找到对应的评价记录');
        }
        return review;
    }

    @Get('target/:targetType/:targetId')
    @ApiQueries(TargetReviewsQuerySchema)
    @ApiSuccessResponse(TargetReviewsResponseSchema, {
        description: '成功获取评价列表',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '获取服务/服务人员的评价',
        description:
            '查看某个服务或服务人员的所有用户评价，支持按具体服务过滤（公开接口，无需登录）',
    })
    async getReviewsByTarget(
        @Param('targetType') targetType: string,
        @Param('targetId') targetId: string,
        @Query(new ZodValidationPipe(TargetReviewsQuerySchema))
        query: TargetReviewsQuery & {
            tab?: 'all' | 'latest' | 'photos' | 'positive' | 'negative';
        },
    ) {
        // 验证 targetType
        const validatedTargetType = ReviewTargetTypeEnum.parse(targetType);

        // 处理查询参数类型转换
        const params: TargetReviewsQuery & {
            tab?: 'all' | 'latest' | 'photos' | 'positive' | 'negative';
        } = {
            page: query.page ? Number(query.page) : 1,
            limit: query.limit ? Number(query.limit) : 10,
            serviceId: query.serviceId,
            // `tab` 为新增筛选字段；未传则按 all 处理。
            tab: query.tab,
        };

        return await this.reviewService.getReviewsByTarget(
            targetId,
            validatedTargetType,
            params,
        );
    }

    @Get('stats/:targetType/:targetId')
    @ApiSuccessResponse(ReviewStatsSchema, {
        description: '成功获取评价统计信息',
    })
    @ApiErrorResponses()
    @ApiOperation({
        summary: '获取评价统计信息',
        description:
            '获取服务人员或店铺的评价统计数据，可选择查询特定服务的统计（公开接口，无需登录）',
    })
    async getReviewStats(
        @Param('targetType') targetType: string,
        @Param('targetId') targetId: string,
        @Query('serviceId') serviceId?: string,
    ): Promise<ReviewStats> {
        // 验证 targetType
        const validatedTargetType = ReviewTargetTypeEnum.parse(targetType);

        return await this.reviewService.getReviewStats(
            targetId,
            validatedTargetType,
            serviceId,
        );
    }
}
