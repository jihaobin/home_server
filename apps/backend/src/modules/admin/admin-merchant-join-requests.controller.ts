import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminMerchantJoinRequestListQuerySchema,
    AdminMerchantJoinRequestListResponseSchema,
    AdminMerchantJoinRequestSchema,
    AdminUpdateMerchantJoinRequestSchema,
    type AdminMerchantJoinRequestListQuery,
    type AdminUpdateMerchantJoinRequest,
} from '@repo/types';
import type { Response } from 'express';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { SkipTransform } from 'src/common/interceptors';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminMerchantJoinRequestsService } from './admin-merchant-join-requests.service';

@ApiTags('管理员商户加盟申请')
@Controller('admin/merchant-join-requests')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminMerchantJoinRequestsController {
    constructor(
        private readonly service: AdminMerchantJoinRequestsService,
    ) {}

    @Get()
    @ApiOperation({
        summary: '查询商户加盟申请列表',
        description: '支持按关键词和联系状态筛选商户加盟申请',
    })
    @ApiSuccessResponse(AdminMerchantJoinRequestListResponseSchema, {
        description: '商户加盟申请分页数据',
    })
    @ApiErrorResponses()
    listMerchantJoinRequests(
        @Query(new ZodValidationPipe(AdminMerchantJoinRequestListQuerySchema))
        query: AdminMerchantJoinRequestListQuery,
    ) {
        return this.service.listMerchantJoinRequests(query);
    }

    @Patch(':id')
    @ApiOperation({
        summary: '更新商户加盟申请处理信息',
        description: '更新管理员备注与已联系状态',
    })
    @ApiSuccessResponse(AdminMerchantJoinRequestSchema, {
        description: '更新后的商户加盟申请记录',
    })
    @ApiErrorResponses()
    updateMerchantJoinRequest(
        @Param('id') id: string,
        @Body(new ZodValidationPipe(AdminUpdateMerchantJoinRequestSchema))
        payload: AdminUpdateMerchantJoinRequest,
    ) {
        return this.service.updateMerchantJoinRequest(id, payload);
    }

    @Get('export.csv')
    @SkipTransform()
    @ApiOperation({
        summary: '导出商户加盟申请 CSV',
        description: '导出全部商户加盟申请为 UTF-8 BOM CSV 文件',
    })
    @ApiErrorResponses()
    async exportMerchantJoinRequestsCsv(@Res({ passthrough: true }) res: Response) {
        const csv = await this.service.exportMerchantJoinRequestsCsv();
        const filename = encodeURIComponent('merchant-join-requests.csv');

        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        });

        return csv;
    }
}
