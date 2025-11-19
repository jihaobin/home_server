import * as OpenApi from '@alicloud/openapi-client';
import * as STS from '@alicloud/sts20150401';
import { Injectable, BadRequestException } from '@nestjs/common';

import { AppLoggerService } from '../logger';

/**
 * STS临时凭证
 */
export interface STSCredentials {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
    expiration: Date;
}

@Injectable()
export class STSService {
    private client: STS.default;
    private credentials: STSCredentials | null = null;
    private expirationTime: number = 0;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000; // 1秒

    constructor(private readonly logger: AppLoggerService) {
        this.logger.setContext(STSService.name);
        // 创建配置
        const config: any = new OpenApi.Config({
            // 设置访问凭证
            accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
        });

        // 访问的域名
        config.endpoint = 'sts.cn-hangzhou.aliyuncs.com';
        this.client = new STS.default(config);
    }

    /**
     * 获取STS临时凭证
     * @returns STS临时凭证
     */
    async getSTSCredentials(): Promise<STSCredentials> {
        // 如果已有凭证且未过期，直接返回
        const now = Date.now();
        if (this.credentials && now < this.expirationTime - 5 * 60 * 1000) {
            return this.credentials;
        }

        let lastError: Error | null = null;
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                const assumeRoleRequest = new STS.AssumeRoleRequest({
                    roleArn: process.env.ALIYUN_STS_ROLE_ARN,
                    roleSessionName: 'smart-lock-session',
                    durationSeconds: 3600,
                });

                this.logger.debug(`尝试获取STS凭证，第 ${i + 1} 次尝试`);
                const response =
                    await this.client.assumeRole(assumeRoleRequest);

                if (!response.body?.credentials) {
                    throw new Error('获取STS凭证失败：响应中没有凭证信息');
                }

                const credentials = response.body.credentials;
                this.credentials = {
                    accessKeyId: credentials.accessKeyId as string,
                    accessKeySecret: credentials.accessKeySecret as string,
                    securityToken: credentials.securityToken as string,
                    expiration: new Date(credentials.expiration as string),
                };

                this.expirationTime = this.credentials.expiration.getTime();
                this.logger.debug('成功获取STS凭证');
                return this.credentials;
            } catch (error) {
                lastError = error as Error;
                this.logger.error(
                    `获取STS凭证失败，第 ${i + 1} 次尝试：${error.message}`,
                    error.stack,
                );

                if (i < this.maxRetries - 1) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, this.retryDelay),
                    );
                    continue;
                }
            }
        }

        throw new BadRequestException(
            `获取STS凭证失败，已重试${this.maxRetries}次：${lastError?.message}`,
        );
    }

    /**
     * 验证STS Token是否有效
     * @param securityToken STS安全令牌
     * @returns 是否有效
     */
    validateToken(securityToken: string): boolean {
        try {
            // 如果当前缓存的凭证与传入的相同，直接校验过期时间
            if (
                this.credentials &&
                this.credentials.securityToken === securityToken
            ) {
                const now = Date.now();
                return now < this.expirationTime;
            }

            // 使用传入的securityToken尝试调用STS服务API
            // 注: 由于STS服务本身不提供专门的Token验证接口，这里采用获取caller身份的方式间接验证
            // 如果Token无效，将会抛出异常

            // 此处可以通过调用任意需要STS Token的轻量级API来验证Token的有效性
            // 例如，可以调用STS自身的GetCallerIdentity API

            this.logger.log(
                'STS Token验证：' +
                    (securityToken
                        ? securityToken.substring(0, 10) + '...'
                        : 'null'),
            );
            return false; // 暂未实现具体验证逻辑，实际应用中应该实现真正的验证
        } catch (error) {
            this.logger.error('验证STS Token失败', error);
            return false;
        }
    }
}
