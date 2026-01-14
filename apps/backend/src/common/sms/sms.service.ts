import * as Dysmsapi from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { CACHE_SERVICE, IAdvancedCacheService, ICacheService } from '../cache';
import { ValidationException } from '../exceptions';
import { AppLoggerService } from '../logger';
import { STSService } from '../sts/sts.service';

// 短信发送限制配置
const SMS_LIMITS = {
    // 同一手机号限制
    PHONE_INTERVAL: 60, // 同一手机号发送间隔（秒）
    PHONE_DAILY_LIMIT: 10, // 同一手机号每天最大发送次数

    // 系统总量限制
    DAILY_TOTAL_LIMIT: 1000, // 每天系统总发送量
    HOURLY_TOTAL_LIMIT: 100, // 每小时系统总发送量
} as const;

/**
 * 短信发送结果接口
 */
export interface SmsSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * 短信状态查询结果接口
 */
export interface SmsStatusResult {
    success: boolean;
    message?: string;
    bizId?: string;
    status?: 'pending' | 'delivered' | 'failed' | 'unknown';
    receiveTime?: string;
    content?: string;
    errorCode?: string;
}

@Injectable()
export class SmsService {
    private client: Dysmsapi.default | null = null;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: ICacheService | IAdvancedCacheService,
        private readonly stsService: STSService,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(SmsService.name);
    }

    /**
     * 获取或创建SMS客户端
     * 使用STS临时凭证
     */
    private async getClient(): Promise<Dysmsapi.default> {
        try {
            // 获取STS临时凭证
            const credentials = await this.stsService.getSTSCredentials();

            // 创建配置
            const config = new OpenApi.Config({
                accessKeyId: credentials.accessKeyId,
                accessKeySecret: credentials.accessKeySecret,
                securityToken: credentials.securityToken, // STS Token
            });
            // 设置访问凭证

            // 访问的域名
            config.endpoint = 'dysmsapi.aliyuncs.com';

            // 创建客户端
            this.client = new Dysmsapi.default(config);
            return this.client;
        } catch (error) {
            const messageText =
                error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(
                `初始化短信客户端失败: ${messageText}`,
                stack,
            );
            throw new BadRequestException(
                `短信服务初始化失败: ${messageText}`,
            );
        }
    }

    private getPhoneKey(phone: string): string {
        return `sms:limit:phone:${phone}`;
    }

    private getPhoneDailyKey(phone: string): string {
        const date = new Date().toISOString().split('T')[0];
        return `sms:limit:phone:daily:${phone}:${date}`;
    }

    private getDailyTotalKey(): string {
        const date = new Date().toISOString().split('T')[0];
        return `sms:limit:total:daily:${date}`;
    }

    private getHourlyTotalKey(): string {
        const date = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        return `sms:limit:total:hourly:${date}:${hour}`;
    }

    private getVerificationCodeKey(phone: string, biz: string) {
        return `verificationCode:${biz}:${phone}`;
    }

    private async checkPhoneLimit(phone: string): Promise<void> {
        // 检查发送间隔
        const phoneKey = this.getPhoneKey(phone);
        const lastSentTime = await this.cacheService.get<string>(phoneKey);

        if (lastSentTime) {
            const remainingTime =
                SMS_LIMITS.PHONE_INTERVAL -
                Math.floor((Date.now() - parseInt(lastSentTime)) / 1000);
            if (remainingTime > 0) {
                throw new BadRequestException(
                    `请等待 ${remainingTime} 秒后再试`,
                );
            }
        }

        // 检查每日限制
        const dailyKey = this.getPhoneDailyKey(phone);
        const dailyCount = parseInt(
            (await this.cacheService.get<string>(dailyKey)) || '0',
        );

        if (dailyCount >= SMS_LIMITS.PHONE_DAILY_LIMIT) {
            throw new BadRequestException(
                '该手机号今日发送次数已达上限，请明天再试',
            );
        }
    }

    private async checkSystemLimit(): Promise<void> {
        // 检查每日总量
        const dailyKey = this.getDailyTotalKey();
        const dailyTotal = parseInt(
            (await this.cacheService.get<string>(dailyKey)) || '0',
        );

        if (dailyTotal >= SMS_LIMITS.DAILY_TOTAL_LIMIT) {
            throw new BadRequestException('系统今日短信配额已用完，请明天再试');
        }

        // 检查每小时总量
        const hourlyKey = this.getHourlyTotalKey();
        const hourlyTotal = parseInt(
            (await this.cacheService.get<string>(hourlyKey)) || '0',
        );

        if (hourlyTotal >= SMS_LIMITS.HOURLY_TOTAL_LIMIT) {
            throw new BadRequestException(
                '系统当前小时短信配额已用完，请稍后再试',
            );
        }
    }

    private async updateLimits(phone: string): Promise<void> {
        // 更新手机号最后发送时间
        const phoneKey = this.getPhoneKey(phone);
        await this.cacheService.set(
            phoneKey,
            Date.now().toString(),
            SMS_LIMITS.PHONE_INTERVAL,
        );

        // 更新手机号每日发送次数
        const dailyKey = this.getPhoneDailyKey(phone);
        await this.incrementAndExpire(dailyKey, 86400); // 24小时过期

        // 更新系统每日总量
        const dailyTotalKey = this.getDailyTotalKey();
        await this.incrementAndExpire(dailyTotalKey, 86400);

        // 更新系统每小时总量
        const hourlyKey = this.getHourlyTotalKey();
        await this.incrementAndExpire(hourlyKey, 3600);
    }

    /**
     * 增加计数并设置过期时间的辅助方法
     * 因为基础缓存接口没有incr方法，需要获取-增加-设置
     */
    private async incrementAndExpire(key: string, ttl: number): Promise<void> {
        // 尝试使用高级缓存接口（如果是IoRedis实现）
        if (this.isAdvancedCache(this.cacheService)) {
            const redis = this.cacheService.getClient<Redis>();
            await redis.incr(key);
            await redis.expire(key, ttl);
            return;
        }

        // 基础缓存接口的兼容实现
        const countStr = (await this.cacheService.get<string>(key)) || '0';
        const newCount = (parseInt(countStr) + 1).toString();
        await this.cacheService.set(key, newCount, ttl);
    }

    /**
     * 类型守卫判断是否为高级缓存实现
     */
    private isAdvancedCache(
        cache: ICacheService | IAdvancedCacheService,
    ): cache is IAdvancedCacheService {
        return 'getClient' in cache;
    }

    /**
     * 发送短信
     * @param phone 手机号
     * @param code 验证码
     * @returns 发送结果和阿里云消息ID
     */
    async sendSms(
        phone: string,
        code: string | number,
    ): Promise<SmsSendResult> {
        const templateCode = process.env.ALIYUN_SMS_TEMPLATE_VERIFICATION || '';
        return this.sendTemplateSms({
            phone,
            templateCode,
            templateParams: { code: code.toString() },
        });
    }

    /**
     * 使用指定模板发送短信
     * @param params 参数
     * @param params.phone 手机号
     * @param params.templateCode 短信模板编码
     * @param params.templateParams 模板参数
     * @param params.signName 签名
     * @returns
     */
    async sendTemplateSms(params: {
        phone: string;
        templateCode: string;
        templateParams?: Record<string, string | number>;
        signName?: string;
        outId?: string;
    }): Promise<SmsSendResult> {
        const { phone, templateCode, templateParams, signName, outId } = params;
        if (!templateCode) {
            const error = '短信模板未配置';
            this.logger.error(
                `${error} phone=${phone} outId=${outId ?? 'none'} envKeys=ALIYUN_SMS_TEMPLATE_VERIFICATION|ALIYUN_SMS_TEMPLATE_CODE`,
            );
            return {
                success: false,
                error,
            };
        }
        try {
            // 获取SMS客户端（使用STS临时凭证）
            const client = await this.getClient();

            const sendSmsRequest = new Dysmsapi.SendSmsRequest({
                phoneNumbers: phone,
                signName: signName || process.env.ALIYUN_SMS_SIGN_NAME,
                templateCode,
                templateParam:
                    templateParams && Object.keys(templateParams).length > 0
                        ? JSON.stringify(templateParams)
                        : undefined,
                outId,
            });

            const runtime = new Util.RuntimeOptions({});
            const response = await client.sendSmsWithOptions(
                sendSmsRequest,
                runtime,
            );

            // 检查短信是否发送成功
            if (!response?.body || response.body.code !== 'OK') {
                const errorMsg = response?.body?.message || '未知错误';
                const errorCode = response?.body?.code || 'UNKNOWN';
                this.logger.error(
                    `短信发送失败 phone=${phone} template=${templateCode} outId=${outId ?? 'none'} 错误码=${errorCode} 消息=${errorMsg}`,
                );
                return {
                    success: false,
                    error: errorMsg,
                };
            }

            // 更新限制计数
            await this.updateLimits(phone);

            // 返回消息ID以便后续查询状态
            return {
                success: true,
                messageId: response.body.bizId || '',
            };
        } catch (error) {
            // 处理错误
            const messageText =
                error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(
                `发送短信异常 phone=${phone} template=${templateCode} outId=${outId ?? 'none'} 错误=${messageText}`,
                stack,
            );
            return {
                success: false,
                error: messageText,
            };
        }
    }

    /**
     * 发送验证码
     * @param params 参数
     * @param params.phone 手机号
     * @param params.codeLength 验证码长度
     * @param params.expires 验证码有效期(分钟)
     * @param params.biz 业务类型
     * @returns
     */
    async sendVerifyCode(params: {
        phone: string;
        codeLength?: number;
        expires?: number;
        biz: string;
    }) {
        const { phone, codeLength = 6, expires = 10, biz } = params;
        // 检查发送限制(发送验证码时，检查发送限制)
        await this.checkPhoneLimit(phone);
        await this.checkSystemLimit();

        const code = Math.floor(
            10 ** (codeLength - 1) +
                Math.random() * (10 ** codeLength - 10 ** (codeLength - 1)),
        ).toString();

        await this.sendSms(phone, code);

        // 存储验证码在缓存中
        const verificationCodeKey = this.getVerificationCodeKey(phone, biz);
        await this.cacheService.set(verificationCodeKey, code, expires * 60);

        return code;
    }

    /**
     * 验证验证码
     * @param params
     * @param params.phone 手机号
     * @param params.code 验证码
     * @param params.biz 业务类型
     * @returns
     */
    async verifyCode(params: { phone: string; code: string; biz: string }) {
        const { phone, code, biz } = params;
        const cacheCode = await this.cacheService.get<string>(
            this.getVerificationCodeKey(phone, biz),
        );
        if (cacheCode !== code) {
            throw new ValidationException('验证码错误');
        }
        return true;
    }

    /**
     * 查询短信发送状态
     * @param bizId 阿里云返回的业务ID
     * @param phone 手机号码
     * @returns 短信发送状态
     */
    async querySmsStatus(
        bizId: string,
        phone: string,
    ): Promise<SmsStatusResult> {
        try {
            // 获取SMS客户端
            const client = await this.getClient();

            // 设置查询时间范围（前后一天范围内的记录）
            const today = new Date();
            const sendDate = this.formatDate(today);

            // 创建查询请求
            const request = new Dysmsapi.QuerySendDetailsRequest({
                phoneNumber: phone,
                bizId: bizId,
                sendDate: sendDate,
                pageSize: 10,
                currentPage: 1,
            });

            const runtime = new Util.RuntimeOptions({});
            const response = await client.querySendDetailsWithOptions(
                request,
                runtime,
            );

            if (!response?.body || response.body.code !== 'OK') {
                const errorMsg = response?.body?.message || '未知错误';
                const errorCode = response?.body?.code || 'UNKNOWN';
                this.logger.error(
                    `查询短信状态失败，错误码: ${errorCode}, 消息: ${errorMsg}`,
                );
                return {
                    success: false,
                    message: errorMsg,
                };
            }

            // 查询逻辑：获取最新的一条记录状态
            const smsList =
                response.body.smsSendDetailDTOs?.smsSendDetailDTO || [];
            if (smsList.length > 0) {
                // 阿里云的状态码: 1=等待回执，2=发送失败，3=发送成功
                const statusMap: Record<
                    number,
                    'pending' | 'failed' | 'delivered'
                > = {
                    1: 'pending',
                    2: 'failed',
                    3: 'delivered',
                };

                const latestSms = smsList[0];
                const sendStatus = latestSms.sendStatus
                    ? parseInt(latestSms.sendStatus.toString())
                    : 0;

                return {
                    success: true,
                    bizId: latestSms.outId || bizId,
                    status: statusMap[sendStatus],
                    receiveTime: latestSms.receiveDate,
                    content: latestSms.content,
                    errorCode: latestSms.errCode,
                };
            }

            return {
                success: false,
                message: '未找到短信记录',
            };
        } catch (error) {
            this.logger.error(
                `查询短信状态失败: ${error.message}`,
                error.stack,
            );
            return {
                success: false,
                message: error.message,
            };
        }
    }

    /**
     * 格式化日期为阿里云API所需格式
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
}
