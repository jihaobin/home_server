import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Logger } from '@nestjs/common';
import { getInternalAccessConfig } from './guard-config';

// 装饰器：标记需要内部访问控制的路由
export const InternalOnly = () => SetMetadata('internal-only', true);

// 装饰器：允许特定IP访问（可选）
export const AllowedIPs = (ips: string[]) => SetMetadata('allowed-ips', ips);

@Injectable()
export class InternalAccessGuard implements CanActivate {
    private readonly logger = new Logger(InternalAccessGuard.name);
    private readonly config = getInternalAccessConfig();

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        // // 检查是否启用内部访问控制
        // if (!this.config.enabled) {
        //   return true;
        // }

        // 检查是否需要内部访问控制
        const isInternalOnly = this.reflector.getAllAndOverride<boolean>(
            'internal-only',
            [context.getHandler(), context.getClass()],
        );

        if (!isInternalOnly) {
            return true; // 如果没有标记为内部访问，则允许通过
        }

        // 获取客户端IP
        const clientIP = this.getClientIP(request);
        this.logger.debug(`Client IP: ${clientIP}`);

        // 检查自定义允许的IP列表
        const allowedIPs =
            this.reflector.getAllAndOverride<string[]>('allowed-ips', [
                context.getHandler(),
                context.getClass(),
            ]) || this.config.allowedIPs;

        if (allowedIPs && allowedIPs.length > 0) {
            if (this.isIPAllowed(clientIP, allowedIPs)) {
                return true;
            }
        }

        // 默认的内部IP检查
        if (this.isInternalIP(clientIP)) {
            return true;
        }

        // 检查内部API密钥（可选的额外安全层）
        if (
            this.config.requireInternalAPIKey &&
            this.checkInternalAPIKey(request)
        ) {
            return true;
        }

        this.logger.warn(
            `Blocked external access attempt from IP: ${clientIP}`,
        );
        throw new ForbiddenException('此接口仅限内部访问');
    }

    /**
     * 获取客户端真实IP地址
     */
    private getClientIP(request: Request): string {
        // 按优先级检查各种可能的IP头
        const ipHeaders = [
            'x-forwarded-for',
            'x-real-ip',
            'x-client-ip',
            'cf-connecting-ip', // Cloudflare
            'x-cluster-client-ip',
            'x-forwarded',
            'forwarded-for',
            'forwarded',
        ];

        for (const header of ipHeaders) {
            const ip = request.headers[header] as string;
            if (ip) {
                // x-forwarded-for 可能包含多个IP，取第一个
                const firstIP = ip.split(',')[0].trim();
                if (this.isValidIP(firstIP)) {
                    return firstIP;
                }
            }
        }

        // 如果没有找到代理IP，使用连接IP
        return (
            request.connection.remoteAddress ||
            request.socket.remoteAddress ||
            (request.connection as any)?.socket?.remoteAddress ||
            '127.0.0.1'
        );
    }

    /**
     * 检查是否为内部IP
     */
    private isInternalIP(ip: string): boolean {
        // 移除IPv6映射前缀
        const cleanIP = ip.replace(/^::ffff:/, '');

        // 本地回环地址检查
        if (
            this.config.allowLocalIPs &&
            (cleanIP === '127.0.0.1' ||
                cleanIP === '::1' ||
                cleanIP === 'localhost')
        ) {
            return true;
        }

        // 私有网络地址范围检查
        if (this.config.allowPrivateIPs) {
            const privateRanges = [
                /^10\./, // 10.0.0.0/8
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
                /^192\.168\./, // 192.168.0.0/16
                /^169\.254\./, // 169.254.0.0/16 (链路本地)
            ];

            return privateRanges.some((range) => range.test(cleanIP));
        }

        return false;
    }

    /**
     * 检查IP是否在允许列表中
     */
    private isIPAllowed(clientIP: string, allowedIPs: string[]): boolean {
        const cleanClientIP = clientIP.replace(/^::ffff:/, '');
        return allowedIPs.some((allowedIP) => {
            const cleanAllowedIP = allowedIP.replace(/^::ffff:/, '');
            return cleanClientIP === cleanAllowedIP;
        });
    }

    /**
     * 验证IP地址格式
     */
    private isValidIP(ip: string): boolean {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    /**
     * 检查内部API密钥（可选的额外安全层）
     */
    private checkInternalAPIKey(request: Request): boolean {
        const internalAPIKey = process.env[this.config.internalAPIKeyEnvVar];
        if (!internalAPIKey) {
            return false; // 如果没有配置内部API密钥，则不进行此检查
        }

        const providedKey = request.headers['x-internal-api-key'] as string;
        return providedKey === internalAPIKey;
    }
}
