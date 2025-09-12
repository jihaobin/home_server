import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ServicePersonnelService } from './service-personnel.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    ServicePersonnelFilterRequest,
    ServicePersonnelFilterRequestSchema,
    ServicePersonnelFilterResponse,
    ServicePersonnelFilterResponseSchema,
} from '@repo/types';
import {
    ApiQueries,
    ApiSuccessResponse,
    ApiErrorResponses,
} from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';

@ApiTags('服务人员管理')
@Controller('service-personnel')
export class ServicePersonnelController {
    constructor(
        private readonly servicePersonnelService: ServicePersonnelService,
    ) {}

    @Get('search')
    @UsePipes(new ZodValidationPipe(ServicePersonnelFilterRequestSchema))
    @ApiOperation({
        summary: '智能筛选服务人员',
        description: `
根据地理位置、价格区间、服务类型等条件智能匹配服务人员。

**核心功能：**
- ✅ 技能匹配：只返回掌握指定服务的人员
- ✅ 地理位置筛选：基于用户位置和最大距离
- ✅ 价格区间筛选：支持个人定价筛选
- ✅ 时间可用性检查：验证工作时间和工作日
- ✅ 服务半径验证：检查用户是否在服务范围内
- ✅ 多维度排序：距离、价格、经验、评分
- ✅ 分页支持：支持大量数据的分页展示

**匹配逻辑：**
1. 首先筛选掌握所需服务技能的人员
2. 检查地理位置是否在搜索范围内
3. 验证价格区间（如果指定）
4. 检查时间可用性（如果指定服务时间）
5. 验证服务人员当前状态
6. 按指定方式排序并分页返回

**智能特性：**
- 自动计算距离和服务半径覆盖
- 实时工作时间匹配
- 综合评分排序（未来支持）
        `,
    })
    @ApiQueries(ServicePersonnelFilterRequestSchema)
    @ApiSuccessResponse(ServicePersonnelFilterResponseSchema, {
        description: '成功获取匹配的服务人员列表',
        isPaginated: true,
    })
    @ApiErrorResponses()
    async searchPersonnel(@Query() query: ServicePersonnelFilterRequest) {
        return await this.servicePersonnelService.findMatchedPersonnel(query);
    }
}
