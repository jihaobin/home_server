import {
    Body,
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
import { UserAuthRealNameService } from './user-auth-real-name.service';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    CreateUserAuthRealName,
    createUserAuthRealNameSchema,
    UpdateUserAuthRealName,
    updateUserAuthRealNameSchema,
    userAuthRealNameApiRequestSchema,
    userAuthRealNameDataSchema,
    UserProfilesSchema,
} from '@repo/types';
import { ApiQueries, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { Roles } from '../auth/decorators';
import type { UserProfiles } from '@repo/types';
import { maskIdCardNumber } from './mask-id-card-number';

const createRealNameAuthNoUserIdSchema = createUserAuthRealNameSchema.omit({
    userId: true,
});

type CreateRealNameAuthNoUserId = Omit<CreateUserAuthRealName, 'userId'>;

const UpdateRealNameAuthNoUserIdSchema = updateUserAuthRealNameSchema.omit({
    userId: true,
});

type UpdateRealNameAuthNoUserId = Omit<UpdateUserAuthRealName, 'userId'>;

type NullableUserProfile = {
    [K in keyof UserProfiles]?: UserProfiles[K] | null;
};

type MaskableUserProfile = NullableUserProfile | null | undefined;

function maskUserProfile<T extends MaskableUserProfile>(profile: T): T {
    if (!profile) {
        return profile;
    }
    return {
        ...profile,
        idCardNumber: maskIdCardNumber(profile.idCardNumber),
    };
}

function maskUserProfileResponse<
    T extends MaskableUserProfile | MaskableUserProfile[],
>(response: T): T {
    if (Array.isArray(response)) {
        return response.map((item) => maskUserProfile(item)) as T;
    }
    return maskUserProfile(response) as T;
}

@ApiTags('用户实名认证')
@Controller('userAuthRealName')
export class UserAuthRealNameController {
    constructor(
        private readonly userAuthRealNameService: UserAuthRealNameService,
    ) {}

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('realNameAuth')
    @UsePipes(
        new ZodValidationPipe(
            userAuthRealNameApiRequestSchema,
            '请求参数验证失败',
            false,
        ),
    )
    @ApiOperation({
        summary: '检查用户信息和身份证是否一致',
        description: '检查用户信息和身份证是否一致',
    })
    @ApiQueries(userAuthRealNameApiRequestSchema)
    @ApiSuccessResponse(userAuthRealNameDataSchema, {
        description: '成功获取实名信息',
    })
    async realNameAuth(
        @Query()
        query: { name: string; idcard: string; faceImageFileId?: string },
        @Req() req: Request,
    ) {
        const response = await this.userAuthRealNameService.authRealName({
            ...query,
            userId: req.user.id,
        });
        return {
            ...response,
            idcard: maskIdCardNumber(response?.idcard),
        };
    }

    @UseGuards(AuthGuard)
    @Get(':userId')
    @ApiOperation({
        summary: '获取用户实名信息',
        description: '获取用户实名信息',
    })
    @ApiParam({ name: 'userId', description: '用户ID' })
    @ApiSuccessResponse(UserProfilesSchema, {
        description: '成功获取实名信息',
    })
    async getUserRealNameByUserId(@Param('userId') id: string) {
        const response =
            await this.userAuthRealNameService.getUserRealNameByUserId(id);
        return maskUserProfileResponse(response);
    }

    @UseGuards(AuthGuard)
    @Post()
    @UsePipes(new ZodValidationPipe(createRealNameAuthNoUserIdSchema))
    @ApiOperation({
        summary: '创建用户实名信息',
        description: '创建用户实名信息',
    })
    @ApiBodies(createRealNameAuthNoUserIdSchema)
    @ApiSuccessResponse(UserProfilesSchema, {
        description: '成功创建实名信息',
    })
    async createUserRealNameAuth(
        @Body() data: CreateRealNameAuthNoUserId,
        @Req() req: Request,
    ) {
        const response =
            await this.userAuthRealNameService.createUserRealNameAuth({
                ...data,
                userId: req.user.id,
            });
        return maskUserProfileResponse(response);
    }

    @UseGuards(AuthGuard)
    @Post(':userId')
    @UsePipes(new ZodValidationPipe(UpdateRealNameAuthNoUserIdSchema))
    @ApiOperation({
        summary: '更新用户实名信息',
        description: '更新用户实名信息',
    })
    @ApiBodies(UpdateRealNameAuthNoUserIdSchema)
    @ApiSuccessResponse(UserProfilesSchema, {
        description: '成功更新实名信息',
    })
    async updateUserRealNameAuth(
        @Body() data: UpdateRealNameAuthNoUserId,
        @Req() req: Request,
    ) {
        const response =
            await this.userAuthRealNameService.updateUserRealNameAuth({
                ...data,
                userId: req.user.id,
            });
        return maskUserProfileResponse(response);
    }

    @UseGuards(AuthGuard)
    @Delete(':userId')
    @ApiOperation({
        summary: '删除用户实名信息',
        description: '删除用户实名信息',
    })
    @ApiParam({ name: 'userId', description: '用户ID' })
    async deleteUserRealNameAuth(@Param('userId') id: string) {
        await this.userAuthRealNameService.deleteUserRealNameAuth(id);
        return '删除成功';
    }
}
