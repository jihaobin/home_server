import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { InternalAccessGuard, InternalOnly } from './guard';
import { ApiExcludeController } from '@nestjs/swagger';

interface OAuth2TokenRequest {
    code: string;
    grant_type?: string;
    client_id?: string;
    client_secret?: string;
    redirect_uri?: string;
}

interface WeChatTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    openid: string;
    scope: string;
    unionid?: string;
    token_type: string;
}

interface WeChatUserInfo {
    openid: string;
    nickname: string;
    sex: number;
    province: string;
    city: string;
    country: string;
    headimgurl: string;
    privilege: string[];
    unionid?: string;
}

@Controller('/auth/wechat')
@ApiExcludeController()
@UseGuards(InternalAccessGuard)
@InternalOnly()
export class WeChatController {
    @Post('token')
    async getAccessToken(
        @Body() body: OAuth2TokenRequest,
    ): Promise<WeChatTokenResponse> {
        console.log('WeChat token request body:', body);

        // better-auth会发送标准的OAuth token请求
        const code = body.code;

        if (!code) {
            throw new Error('Missing authorization code');
        }

        const tokenUrl = new URL(
            'https://api.weixin.qq.com/sns/oauth2/access_token',
        );
        tokenUrl.searchParams.set('appid', process.env.WECHAT_CLIENT_ID!);
        tokenUrl.searchParams.set('secret', process.env.WECHAT_CLIENT_SECRET!);
        tokenUrl.searchParams.set('code', code);
        tokenUrl.searchParams.set('grant_type', 'authorization_code');

        const response = await fetch(tokenUrl.toString());
        const data = await response.json();

        console.log('WeChat token response:', data);

        if (data.errcode) {
            console.error('WeChat OAuth error:', data);
            throw new Error(`WeChat OAuth error: ${data.errmsg}`);
        }

        // 返回符合OAuth2标准的响应，同时保留微信特有字段
        const tokenResponse = {
            access_token: data.access_token,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token,
            openid: data.openid,
            // 将openid嵌入到标准OAuth2字段中
            scope: `snsapi_login openid:${data.openid} unionid:${data.unionid || ''}`,
            token_type: 'bearer',
        };

        console.log('Returning token response:', tokenResponse);
        return tokenResponse;
    }

    @Get('userinfo')
    async getUserInfo(
        @Query('access_token') accessToken: string,
        @Query('openid') openid: string,
        @Query('lang') lang: string = 'zh_CN',
    ): Promise<WeChatUserInfo> {
        const userInfoUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
        userInfoUrl.searchParams.set('access_token', accessToken);
        userInfoUrl.searchParams.set('openid', openid);
        userInfoUrl.searchParams.set('lang', lang);

        const response = await fetch(userInfoUrl.toString());
        const userInfo = await response.json();

        if (userInfo.errcode) {
            throw new Error(`WeChat getUserInfo error: ${userInfo.errmsg}`);
        }

        return userInfo;
    }

    @Post('refresh-token')
    async refreshToken(@Body() body: { refresh_token: string }) {
        const { refresh_token } = body;

        const refreshUrl = new URL(
            'https://api.weixin.qq.com/sns/oauth2/refresh_token',
        );
        refreshUrl.searchParams.set('appid', process.env.WECHAT_CLIENT_ID!);
        refreshUrl.searchParams.set('grant_type', 'refresh_token');
        refreshUrl.searchParams.set('refresh_token', refresh_token);

        const response = await fetch(refreshUrl.toString());
        const data = await response.json();

        if (data.errcode) {
            throw new Error(`WeChat refresh token error: ${data.errmsg}`);
        }

        return {
            ...data,
            token_type: 'bearer',
        };
    }
}
