import Credential from '@alicloud/credentials';
import * as Dyvmsapi from '@alicloud/dyvmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { CACHE_SERVICE, IAdvancedCacheService, ICacheService } from '../cache';
import { AppLoggerService } from '../logger';
import { STSService } from '../sts/sts.service';

const VOICE_CALL_LIMITS = {
    PHONE_INTERVAL: 60,
    PHONE_DAILY_LIMIT: 5,
    DAILY_TOTAL_LIMIT: 1000,
    HOURLY_TOTAL_LIMIT: 50,
} as const;

export interface VoiceTtsCallParams {
    calledNumber: string;
    ttsCode: string;
    calledShowNumber?: string;
    ttsParam?: Record<string, string | number>;
    outId?: string;
}

export interface VoiceTtsCallResult {
    success: boolean;
    callId?: string;
    requestId?: string;
    code?: string;
    message?: string;
    outId?: string;
    error?: string;
    recommend?: string;
}

@Injectable()
export class VoiceCallService {
    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: ICacheService | IAdvancedCacheService,
        private readonly stsService: STSService,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(VoiceCallService.name);
    }

    async singleCallByTts(
        params: VoiceTtsCallParams,
    ): Promise<VoiceTtsCallResult> {
        const calledNumber = this.normalizePhone(params.calledNumber);
        const calledShowNumber = this.normalizeOptionalPhone(
            params.calledShowNumber ??
                process.env.ALIYUN_DYVMS_CALLED_SHOW_NUMBER,
        );

        if (!calledNumber) {
            this.logVoiceCallAudit(params.calledNumber, {
                success: false,
                error: '被叫号码不能为空',
            });
            throw new BadRequestException('被叫号码不能为空');
        }
        try {
            this.ensurePhoneFormat(calledNumber, '被叫号码格式不正确');
        } catch (error) {
            const detail =
                error instanceof Error ? error.message : String(error);
            this.logVoiceCallAudit(calledNumber, {
                success: false,
                error: detail,
            });
            throw error;
        }
        if (!params.ttsCode?.trim()) {
            this.logVoiceCallAudit(calledNumber, {
                success: false,
                error: 'ttsCode 不能为空',
            });
            throw new BadRequestException('ttsCode 不能为空');
        }
        if (calledShowNumber) {
            try {
                this.ensurePhoneFormat(calledShowNumber, '外显号码格式不正确');
            } catch (error) {
                const detail =
                    error instanceof Error ? error.message : String(error);
                this.logVoiceCallAudit(calledNumber, {
                    success: false,
                    error: detail,
                });
                throw error;
            }
        }

        try {
            await this.checkPhoneLimit(calledNumber);
            await this.checkSystemLimit();
        } catch (error) {
            const detail =
                error instanceof Error ? error.message : String(error);
            this.logVoiceCallAudit(calledNumber, {
                success: false,
                error: detail,
            });
            throw error;
        }

        try {
            const client = await this.getClient();
            const request = new Dyvmsapi.SingleCallByTtsRequest({
                calledNumber,
                calledShowNumber: calledShowNumber ?? undefined,
                ttsCode: params.ttsCode.trim(),
                ttsParam:
                    params.ttsParam && Object.keys(params.ttsParam).length > 0
                        ? JSON.stringify(params.ttsParam)
                        : undefined,
                outId: params.outId?.trim() || undefined,
            });
            const runtime = new Util.RuntimeOptions({});
            const response = await client.singleCallByTtsWithOptions(
                request,
                runtime,
            );

            if (!response?.body || response.body.code !== 'OK') {
                const code = response?.body?.code || 'UNKNOWN';
                const message = response?.body?.message || '语音通话发起失败';
                this.logger.error(
                    `语音通话发起失败 calledNumber=${this.maskPhone(calledNumber)} ttsCode=${params.ttsCode} outId=${params.outId ?? 'none'} code=${code} message=${message}`,
                );
                const result = {
                    success: false,
                    code,
                    message,
                    outId: params.outId,
                    error: message,
                };
                this.logVoiceCallAudit(calledNumber, result);
                return result;
            }

            await this.updateLimits(calledNumber);

            const result = {
                success: true,
                callId: response.body.callId || undefined,
                requestId: response.body.requestId || undefined,
                code: response.body.code || undefined,
                message: response.body.message || undefined,
                outId: params.outId,
            };
            this.logVoiceCallAudit(calledNumber, result);
            return result;
        } catch (error) {
            const parsed = this.parseSdkError(error);
            this.logger.error(
                `语音通话异常 calledNumber=${this.maskPhone(calledNumber)} ttsCode=${params.ttsCode} outId=${params.outId ?? 'none'} error=${parsed.message}`,
                parsed.stack,
            );
            const result = {
                success: false,
                outId: params.outId,
                error: parsed.message,
                recommend: parsed.recommend,
            };
            this.logVoiceCallAudit(calledNumber, result);
            return result;
        }
    }

    private logVoiceCallAudit(
        calledNumber: string,
        result: Pick<
            VoiceTtsCallResult,
            'success' | 'error' | 'message' | 'code'
        >,
    ): void {
        const failureDetail = result.success
            ? 'none'
            : (result.error ??
              result.message ??
              (result.code ? `code=${result.code}` : 'unknown'));
        const logLine = `语音调用日志 calledNumber=${calledNumber} success=${result.success} failureDetail=${failureDetail}`;

        if (result.success) {
            this.logger.log(logLine);
            return;
        }
        this.logger.warn(logLine);
    }

    private async getClient(): Promise<Dyvmsapi.default> {
        try {
            return this.shouldUseDefaultCredentialChain()
                ? this.createClientWithDefaultCredential()
                : await this.createClientWithSts();
        } catch (error) {
            const parsed = this.parseSdkError(error);
            this.logger.error(
                `初始化语音通话客户端失败: ${parsed.message}`,
                parsed.stack,
            );
            throw new BadRequestException(
                `语音通话服务初始化失败: ${parsed.message}`,
            );
        }
    }

    private shouldUseDefaultCredentialChain(): boolean {
        return process.env.ALIYUN_DYVMS_USE_DEFAULT_CREDENTIAL === 'true';
    }

    private createClientWithDefaultCredential(): Dyvmsapi.default {
        const credential = new Credential();
        const config = new OpenApi.Config({
            credential,
        });
        config.endpoint = this.getEndpoint();
        return new Dyvmsapi.default(config);
    }

    private async createClientWithSts(): Promise<Dyvmsapi.default> {
        const credentials = await this.stsService.getSTSCredentials();
        const config = new OpenApi.Config({
            accessKeyId: credentials.accessKeyId,
            accessKeySecret: credentials.accessKeySecret,
            securityToken: credentials.securityToken,
        });
        config.endpoint = this.getEndpoint();
        return new Dyvmsapi.default(config);
    }

    private getEndpoint(): string {
        return process.env.ALIYUN_DYVMS_ENDPOINT || 'dyvmsapi.aliyuncs.com';
    }

    private getPhoneKey(phone: string): string {
        return `voice:limit:phone:${phone}`;
    }

    private getPhoneDailyKey(phone: string): string {
        const date = this.getUtcDate();
        return `voice:limit:phone:daily:${phone}:${date}`;
    }

    private getDailyTotalKey(): string {
        const date = this.getUtcDate();
        return `voice:limit:total:daily:${date}`;
    }

    private getHourlyTotalKey(): string {
        const now = new Date();
        const date = this.getUtcDate(now);
        const hour = now.getUTCHours();
        return `voice:limit:total:hourly:${date}:${hour}`;
    }

    private getUtcDate(now = new Date()): string {
        return now.toISOString().split('T')[0];
    }

    private async checkPhoneLimit(phone: string): Promise<void> {
        const phoneKey = this.getPhoneKey(phone);
        const lastSentTime = await this.cacheService.get<string>(phoneKey);

        if (lastSentTime) {
            const remainingTime =
                VOICE_CALL_LIMITS.PHONE_INTERVAL -
                Math.floor((Date.now() - parseInt(lastSentTime, 10)) / 1000);
            if (remainingTime > 0) {
                throw new BadRequestException(
                    `请等待 ${remainingTime} 秒后再试`,
                );
            }
        }

        const dailyKey = this.getPhoneDailyKey(phone);
        const dailyCount = parseInt(
            (await this.cacheService.get<string>(dailyKey)) || '0',
            10,
        );
        if (dailyCount >= VOICE_CALL_LIMITS.PHONE_DAILY_LIMIT) {
            throw new BadRequestException(
                '该手机号今日语音通话次数已达上限，请明天再试',
            );
        }
    }

    private async checkSystemLimit(): Promise<void> {
        const dailyKey = this.getDailyTotalKey();
        const dailyTotal = parseInt(
            (await this.cacheService.get<string>(dailyKey)) || '0',
            10,
        );
        if (dailyTotal >= VOICE_CALL_LIMITS.DAILY_TOTAL_LIMIT) {
            throw new BadRequestException('系统今日语音通话配额已用完');
        }

        const hourlyKey = this.getHourlyTotalKey();
        const hourlyTotal = parseInt(
            (await this.cacheService.get<string>(hourlyKey)) || '0',
            10,
        );
        if (hourlyTotal >= VOICE_CALL_LIMITS.HOURLY_TOTAL_LIMIT) {
            throw new BadRequestException('系统当前小时语音通话配额已用完');
        }
    }

    private async updateLimits(phone: string): Promise<void> {
        await this.cacheService.set(
            this.getPhoneKey(phone),
            Date.now().toString(),
            VOICE_CALL_LIMITS.PHONE_INTERVAL,
        );
        await this.incrementAndExpire(this.getPhoneDailyKey(phone), 86400);
        await this.incrementAndExpire(this.getDailyTotalKey(), 86400);
        await this.incrementAndExpire(this.getHourlyTotalKey(), 3600);
    }

    private async incrementAndExpire(key: string, ttl: number): Promise<void> {
        if (this.isAdvancedCache(this.cacheService)) {
            const redis = this.cacheService.getClient<Redis>();
            await redis.incr(key);
            await redis.expire(key, ttl);
            return;
        }

        const countStr = (await this.cacheService.get<string>(key)) || '0';
        const nextCount = (parseInt(countStr, 10) + 1).toString();
        await this.cacheService.set(key, nextCount, ttl);
    }

    private isAdvancedCache(
        cache: ICacheService | IAdvancedCacheService,
    ): cache is IAdvancedCacheService {
        return 'getClient' in cache;
    }

    private normalizeOptionalPhone(value?: string | null): string | null {
        if (!value) {
            return null;
        }
        return this.normalizePhone(value);
    }

    private normalizePhone(value: string): string {
        const trimmed = value.replace(/[\s-]/g, '');
        if (trimmed.startsWith('+86')) {
            return trimmed.slice(3);
        }
        if (trimmed.startsWith('86')) {
            return trimmed.slice(2);
        }
        return trimmed;
    }

    private ensurePhoneFormat(value: string, message: string): void {
        if (!/^\d{5,20}$/.test(value)) {
            throw new BadRequestException(message);
        }
    }

    private maskPhone(phone: string): string {
        if (phone.length <= 4) {
            return '*'.repeat(phone.length);
        }
        return `${phone.slice(0, Math.min(3, phone.length - 4))}${'*'.repeat(Math.max(phone.length - 7, 1))}${phone.slice(-4)}`;
    }

    private parseSdkError(error: unknown): {
        message: string;
        stack?: string;
        recommend?: string;
    } {
        const fallback = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        let recommend: string | undefined;

        if (typeof error === 'object' && error !== null && 'data' in error) {
            const data = error.data;
            if (typeof data === 'object' && data !== null) {
                if ('Recommend' in data && typeof data.Recommend === 'string') {
                    recommend = data.Recommend;
                }
                if ('Message' in data && typeof data.Message === 'string') {
                    return {
                        message: data.Message,
                        stack,
                        recommend,
                    };
                }
            }
        }

        return {
            message: fallback,
            stack,
            recommend,
        };
    }
}
