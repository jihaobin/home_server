import { Controller, Get, Query } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressQuery, AddressQuerySchema, ChinaCitySchema } from '@repo/types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod/v4';
import {
    ApiQueries,
    ApiSuccessResponse,
    ApiErrorResponses,
} from 'src/common/decorator';

@ApiTags('地址管理')
@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}

    @ApiOperation({
        summary: '获取中国城市数据',
        description:
            '根据筛选条件获取中国省市区数据，支持获取全部、省份、城市或区县数据',
    })
    @ApiSuccessResponse(z.array(ChinaCitySchema), {
        description: '成功获取城市列表',
        example: {
            code: 0,
            message: '操作成功',
            data: [
                {
                    id: 1,
                    pid: 0,
                    deep: 0,
                    name: '北京',
                    pinyin_prefix: 'B',
                    pinyin: 'beijing',
                    ext_id: '110000',
                    ext_name: '北京市',
                },
            ],
            timestamp: Date.now(),
        },
    })
    @ApiErrorResponses()
    @ApiQueries(AddressQuerySchema)
    @Get('all')
    findAll(@Query() query: AddressQuery) {
        return this.addressService.findAll(query);
    }
}
