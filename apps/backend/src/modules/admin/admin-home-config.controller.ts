import {
    Body,
    Controller,
    Get,
    Put,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AdminHomeConfigSchema,
    AdminHomeConfigUpdateSchema,
    type AdminHomeConfigUpdate,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/decorators';
import { AdminHomeConfigService } from './admin-home-config.service';

@ApiTags('管理员-首页配置')
@Controller('admin/home')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminHomeConfigController {
    constructor(private readonly service: AdminHomeConfigService) {}

    @Get('config')
    @ApiOperation({
        summary: '获取首页配置',
        description: '返回 banners/guarantees/promos（包含可渲染 URL）',
    })
    @ApiSuccessResponse(AdminHomeConfigSchema)
    @ApiErrorResponses()
    async getConfig() {
        return await this.service.getConfig();
    }

    @Put('config')
    @UsePipes(new ZodValidationPipe(AdminHomeConfigUpdateSchema))
    @ApiOperation({
        summary: '更新首页配置',
        description: '全量覆盖语义：PUT 未包含的条目将被删除',
    })
    @ApiSuccessResponse(AdminHomeConfigSchema)
    @ApiErrorResponses()
    async updateConfig(@Body() body: AdminHomeConfigUpdate) {
        return await this.service.updateConfig(body);
    }
}
