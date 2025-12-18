import { Injectable, Logger } from '@nestjs/common';
import { ofetch } from 'ofetch';
import { randomBytes } from 'node:crypto';
import { TLSSigApi } from './TLSSigAPIv2';

interface TencentCloudOfflinePushInfo {
    PushFlag?: 0 | 1;
    Title?: string;
    Desc?: string;
    Ext?: string;
}

interface TencentCloudBatchPushRequest {
    From_Account: string;
    To_Account: string[];
    MsgRandom: number;
    OfflinePushInfo: TencentCloudOfflinePushInfo;
    DataId?: string;
}

interface TencentCloudBatchPushResponse {
    ActionStatus: 'OK' | 'FAIL';
    ErrorCode: number;
    ErrorInfo: string;
    TaskId?: string;
}

export interface TencentCloudPushPayload {
    accounts: string[];
    title: string;
    body: string;
    dataId?: string;
    pushFlag?: 0 | 1;
    ext?: Record<string, unknown>;
}

export interface TencentCloudPushResult {
    taskId?: string;
}

interface TencentConfiguredContext {
    sdkAppId: number;
    identifier: string;
    secretKey: string;
    fromAccount: string;
}

@Injectable()
export class TencentCloudPushService {
    private readonly logger = new Logger(TencentCloudPushService.name);
    private readonly baseUrl: string;
    private readonly sdkAppId?: number;
    private readonly identifier?: string;
    private readonly secretKey?: string;
    private readonly fromAccount?: string;
    private readonly userSigExpireSeconds: number;
    private readonly sigRenewalReserveSeconds = 60;
    private sigCache?: {
        value: string;
        expiresAt: number;
    };
    private tlsSigApi?: TLSSigApi;
    private tlsSigContext?: Pick<
        TencentConfiguredContext,
        'sdkAppId' | 'secretKey'
    >;
    private readonly client: typeof ofetch;

    constructor() {
        this.baseUrl =
            process.env.TENCENT_PUSH_BASE_URL ?? 'https://console.tim.qq.com';
        this.sdkAppId = this.parseNumber(process.env.TENCENT_PUSH_SDK_APP_ID);
        this.identifier = process.env.TENCENT_PUSH_ADMIN_IDENTIFIER;
        this.secretKey = process.env.TENCENT_PUSH_SECRET_KEY;
        this.fromAccount =
            process.env.TENCENT_PUSH_FROM_ACCOUNT ?? this.identifier;
        this.userSigExpireSeconds =
            this.parseNumber(process.env.TENCENT_PUSH_USERSIG_EXPIRE_SECONDS) ??
            3600;

        this.client = ofetch.create({
            baseURL: this.baseUrl,
            retry: 0,
            timeout: 5000,
        });
    }

    isConfigured(): boolean {
        return Boolean(this.sdkAppId && this.identifier && this.secretKey);
    }

    getSdkAppId(): number | undefined {
        return this.sdkAppId;
    }

    async sendBatchPush(
        payload: TencentCloudPushPayload,
    ): Promise<TencentCloudPushResult> {
        if (!this.isConfigured()) {
            throw new Error('腾讯云推送凭证尚未配置');
        }
        if (!payload.accounts?.length) {
            throw new Error('缺少待推送账号');
        }
        if (payload.accounts.length > 500) {
            throw new Error('单次推送账号数量不能超过500个');
        }
        const context = this.ensureContext();
        const requestBody: TencentCloudBatchPushRequest = {
            From_Account: context.fromAccount,
            To_Account: [...new Set(payload.accounts)],
            MsgRandom: this.randomUint32(),
            OfflinePushInfo: {
                PushFlag: payload.pushFlag ?? 0,
                Title: payload.title || '服务提醒',
                Desc: payload.body || '您有新的通知，请打开 App 查看',
                Ext: this.stringifyExt(payload.ext),
            },
            DataId: payload.dataId,
        };
        const query = {
            sdkappid: context.sdkAppId,
            identifier: context.identifier,
            usersig: this.getUserSig(),
            random: this.randomUint32(),
            contenttype: 'json',
        };

        try {
            const response = await this.client<TencentCloudBatchPushResponse>(
                '/v4/timpush/batch',
                {
                    method: 'POST',
                    query,
                    body: requestBody,
                },
            );
            if (
                response.ActionStatus !== 'OK' ||
                typeof response.ErrorCode !== 'number' ||
                response.ErrorCode !== 0
            ) {
                const code = response.ErrorCode ?? -1;
                const detail = response.ErrorInfo || '未知错误';
                throw new Error(`腾讯云推送失败(${code}): ${detail}`);
            }
            return { taskId: response.TaskId };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn('调用腾讯云推送接口失败', message);
            throw new Error(message);
        }
    }

    private stringifyExt(ext?: Record<string, unknown>): string | undefined {
        if (!ext || !Object.keys(ext).length) {
            return undefined;
        }
        const json = JSON.stringify(ext);
        const maxLength = 1800;
        if (json.length > maxLength) {
            this.logger.warn(
                `腾讯云离线推送扩展字段长度(${json.length})已超过建议上限 ${maxLength}，请精简 payload`,
            );
        }
        return json;
    }

    private ensureContext(): TencentConfiguredContext {
        if (
            !this.sdkAppId ||
            !this.identifier ||
            !this.secretKey ||
            !this.fromAccount
        ) {
            throw new Error('腾讯云推送凭证不完整');
        }
        return {
            sdkAppId: this.sdkAppId,
            identifier: this.identifier,
            secretKey: this.secretKey,
            fromAccount: this.fromAccount,
        };
    }

    private getUserSig(): string {
        const now = Date.now();
        if (
            this.sigCache &&
            this.sigCache.expiresAt - this.sigRenewalReserveSeconds * 1000 > now
        ) {
            return this.sigCache.value;
        }
        const userSig = this.generateUserSig();
        this.sigCache = {
            value: userSig,
            expiresAt: now + this.userSigExpireSeconds * 1000,
        };
        return userSig;
    }

    private generateUserSig(): string {
        const context = this.ensureContext();
        const api = this.getTlsSigApi(context);
        return api.genUserSig(context.identifier, this.userSigExpireSeconds);
    }

    private getTlsSigApi(context: TencentConfiguredContext): TLSSigApi {
        if (
            !this.tlsSigApi ||
            !this.tlsSigContext ||
            this.tlsSigContext.sdkAppId !== context.sdkAppId ||
            this.tlsSigContext.secretKey !== context.secretKey
        ) {
            this.tlsSigApi = new TLSSigApi(context.sdkAppId, context.secretKey);
            this.tlsSigContext = {
                sdkAppId: context.sdkAppId,
                secretKey: context.secretKey,
            };
        }
        return this.tlsSigApi;
    }

    private randomUint32(): number {
        const buffer = randomBytes(4);
        return buffer.readUInt32BE(0);
    }

    private parseNumber(raw?: string): number | undefined {
        if (!raw) {
            return undefined;
        }
        const value = Number(raw);
        return Number.isFinite(value) ? value : undefined;
    }
}
