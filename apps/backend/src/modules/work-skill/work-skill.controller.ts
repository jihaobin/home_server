import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    PersonnelDetailInfoSchema,
    PersonnelPricingInfoSchema,
    ServicePersonnelSchema,
    ServiceOfferingSubmissionResultSchema,
    SkillUpdateResultSchema,
    type UpdateServiceNonSensitiveFieldsRequest,
    type UpdatePersonnelSkillsRequest,
    UpdatePersonnelSkillsRequestSchema,
    type UpsertPersonnelPricingRequest,
    UpsertPersonnelPricingRequestSchema,
    type UpdateServiceOfferingsRequest,
    UpdateServiceOfferingsRequestSchema,
    UpdateServiceNonSensitiveFieldsRequestSchema,
    type UpsertWorkInfoRequest,
    UpsertWorkInfoRequestSchema,
    WithdrawServiceDraftResponseSchema,
    WorkerServicesResponseSchema,
} from '@repo/types';
import { Request } from 'express';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { ZodValidationPipe } from 'src/common/pipes';
import { z } from 'zod/v4';
import { AuthGuard } from '../auth/auth.guard';
import { WorkSkillService } from './work-skill.service';

const UpdateWorkerServiceBodySchema =
    UpdateServiceNonSensitiveFieldsRequestSchema.omit({ serviceId: true });
const UpdateWorkerServicePayloadPipe = new ZodValidationPipe(
    UpdateServiceNonSensitiveFieldsRequestSchema,
);
const DeleteWorkerServiceBodySchema = z.object({
    confirmName: z.string().min(1),
});

@ApiTags('工作技能管理')
@Controller('workSkill')
export class WorkSkillController {
    constructor(private readonly workSkillService: WorkSkillService) {}

    @UseGuards(AuthGuard)
    @Post('workInfo')
    @UsePipes(new ZodValidationPipe(UpsertWorkInfoRequestSchema))
    @ApiOperation({
        summary: '创建或更新工作人员信息',
        description:
            '创建或更新当前用户的工作人员信息，如果工作人员不存在则创建新记录，已存在则更新现有记录',
    })
    @ApiBodies(UpsertWorkInfoRequestSchema)
    @ApiSuccessResponse(ServicePersonnelSchema, {
        description: '成功创建或更新工作人员信息',
    })
    @ApiErrorResponses()
    async upsertWorkInfo(
        @Body() workInfo: UpsertWorkInfoRequest,
        @Req() req: Request,
    ) {
        return await this.workSkillService.upsertWorkInfo(
            req.user.id,
            workInfo,
        );
    }

    @UseGuards(AuthGuard)
    @Put('offerings')
    @UsePipes(new ZodValidationPipe(UpdateServiceOfferingsRequestSchema))
    @ApiOperation({
        summary: '更新服务分类与规格',
        description: '批量配置服务分类、服务描述以及不同规格的价格和耗时',
    })
    @ApiBodies(UpdateServiceOfferingsRequestSchema)
    @ApiSuccessResponse(ServiceOfferingSubmissionResultSchema, {
        description: '成功提交服务设置审核',
    })
    @ApiErrorResponses()
    async updateServiceOfferings(
        @Body() payload: UpdateServiceOfferingsRequest,
        @Req() req: Request,
    ) {
        return await this.workSkillService.updateServiceOfferings(
            req.user.id,
            payload,
        );
    }

    @UseGuards(AuthGuard)
    @Get('worker/services')
    @ApiOperation({
        summary: '获取服务人员服务审核聚合列表',
    })
    @ApiSuccessResponse(WorkerServicesResponseSchema, {
        description: '成功获取服务人员服务审核聚合列表',
    })
    async listWorkerServices(@Req() req: Request) {
        const services = await this.workSkillService.listWorkerServices(
            req.user.id,
        );
        return { services };
    }

    @UseGuards(AuthGuard)
    @Patch('worker/services/:serviceId')
    @ApiOperation({
        summary: '更新服务人员服务非敏感字段',
    })
    @ApiParam({
        name: 'serviceId',
        description: '服务ID',
        type: String,
    })
    @ApiBodies(UpdateWorkerServiceBodySchema)
    async updateWorkerServiceNonSensitiveFields(
        @Param('serviceId') serviceId: string,
        @Body() body: Record<string, never>,
        @Req() req: Request,
    ) {
        const payload = UpdateWorkerServicePayloadPipe.transform(
            { serviceId, ...body },
            { type: 'body' },
        ) as UpdateServiceNonSensitiveFieldsRequest;

        return await this.workSkillService.updateServiceNonSensitiveFields(
            req.user.id,
            payload,
        );
    }

    @UseGuards(AuthGuard)
    @Post('worker/services/:serviceId/takedown')
    @ApiOperation({
        summary: '服务人员主动下架服务',
    })
    @ApiParam({
        name: 'serviceId',
        description: '服务ID',
        type: String,
    })
    async selfTakedownService(
        @Param('serviceId') serviceId: string,
        @Req() req: Request,
    ) {
        return await this.workSkillService.selfTakedownService(
            req.user.id,
            serviceId,
        );
    }

    @UseGuards(AuthGuard)
    @Delete('worker/services/:serviceId')
    @ApiOperation({
        summary: '服务人员删除整个服务',
    })
    @ApiParam({
        name: 'serviceId',
        description: '服务ID',
        type: String,
    })
    @ApiBodies(DeleteWorkerServiceBodySchema)
    async deleteWorkerService(
        @Param('serviceId') serviceId: string,
        @Body(new ZodValidationPipe(DeleteWorkerServiceBodySchema))
        body: z.infer<typeof DeleteWorkerServiceBodySchema>,
        @Req() req: Request,
    ) {
        return await this.workSkillService.deleteWorkerService(
            req.user.id,
            serviceId,
            body.confirmName,
        );
    }

    @UseGuards(AuthGuard)
    @Delete('worker/services/:serviceId/draft')
    @ApiOperation({
        summary: '撤回服务审核草稿',
    })
    @ApiParam({
        name: 'serviceId',
        description: '服务ID',
        type: String,
    })
    @ApiSuccessResponse(WithdrawServiceDraftResponseSchema, {
        description: '成功撤回服务审核草稿',
    })
    async withdrawServiceDraft(
        @Param('serviceId') serviceId: string,
        @Req() req: Request,
    ) {
        return await this.workSkillService.withdrawServiceDraft(
            req.user.id,
            serviceId,
        );
    }

    @UseGuards(AuthGuard)
    @Put('skills')
    @UsePipes(new ZodValidationPipe(UpdatePersonnelSkillsRequestSchema))
    @ApiOperation({
        summary: '更新工作人员技能',
        description:
            '更新当前用户的技能列表，支持新增、删除和完整更新。传入空数组将清除所有技能',
    })
    @ApiBodies(UpdatePersonnelSkillsRequestSchema)
    @ApiSuccessResponse(SkillUpdateResultSchema, {
        description: '成功更新技能，返回操作统计',
    })
    @ApiErrorResponses()
    async updatePersonnelSkills(
        @Body() skillsData: UpdatePersonnelSkillsRequest,
        @Req() req: Request,
    ) {
        return await this.workSkillService.updatePersonnelSkills(
            req.user.id,
            skillsData,
        );
    }

    @Get('personnel/:personnelId')
    @ApiOperation({
        summary: '获取工作人员信息',
        description: '获取指定工作人员的完整信息，包括基本信息和技能列表',
    })
    @ApiParam({
        name: 'personnelId',
        description: '工作人员用户ID',
        type: 'string',
    })
    @ApiSuccessResponse(PersonnelDetailInfoSchema, {
        description: '成功获取工作人员信息',
    })
    @ApiErrorResponses()
    async getPersonnelInfo(@Param('personnelId') personnelId: string) {
        const personnel =
            await this.workSkillService.getPersonnelInfo(personnelId);
        if (!personnel) {
            throw new Error('工作人员不存在');
        }
        return personnel;
    }

    @UseGuards(AuthGuard)
    @Post('pricing')
    @UsePipes(new ZodValidationPipe(UpsertPersonnelPricingRequestSchema))
    @ApiOperation({
        summary: '设置或更新服务人员定价',
        description:
            '设置或更新当前用户对某个服务的个人定价，如果已存在则更新，不存在则创建',
    })
    @ApiBodies(UpsertPersonnelPricingRequestSchema)
    @ApiSuccessResponse(PersonnelPricingInfoSchema, {
        description: '成功设置或更新定价',
    })
    @ApiErrorResponses()
    async upsertPersonnelPricing(
        @Body() pricingData: UpsertPersonnelPricingRequest,
        @Req() req: Request,
    ) {
        return await this.workSkillService.upsertPersonnelPricing(
            req.user.id,
            pricingData.serviceId,
            pricingData.price,
            pricingData.estimatedDurationMinutes,
            pricingData.currency,
        );
    }

    @UseGuards(AuthGuard)
    @Get('pricing')
    @ApiOperation({
        summary: '获取当前用户的所有定价',
        description: '获取当前用户作为服务人员的所有个人定价信息',
    })
    @ApiSuccessResponse(PersonnelPricingInfoSchema.array(), {
        description: '成功获取定价列表',
    })
    @ApiErrorResponses()
    async getPersonnelPricing(@Req() req: Request) {
        return await this.workSkillService.getPersonnelPricing(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Delete('pricing/:serviceId')
    @ApiOperation({
        summary: '删除服务人员定价',
        description: '删除当前用户对某个服务的个人定价',
    })
    @ApiParam({
        name: 'serviceId',
        description: '服务ID',
        type: 'string',
    })
    @ApiSuccessResponse(z.boolean(), {
        description: '成功删除定价，返回是否成功',
    })
    @ApiErrorResponses()
    async removePersonnelPricing(
        @Param('serviceId') serviceId: string,
        @Req() req: Request,
    ) {
        return await this.workSkillService.removePersonnelPricing(
            req.user.id,
            serviceId,
        );
    }
}
