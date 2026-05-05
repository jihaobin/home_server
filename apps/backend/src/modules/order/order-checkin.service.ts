import { createHash, randomBytes } from 'node:crypto';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderCheckinPayload, VerifyOrderCheckinDto } from '@repo/types';
import * as QRCode from 'qrcode';
import { GeoLocationService } from 'src/common/services/geo-location.service';
import { OrderRepository } from './order.reposityro';
import { OrderCheckinRepository } from './order-checkin.repository';
import { OrderService } from './order.service';

export interface GenerateQrResult {
    orderId: string;
    token: string;
    expiresAt: Date;
    ttlSeconds: number;
    qrCodeDataUrl: string;
    payload: OrderCheckinPayload;
}

export interface VerifyResult {
    orderId: string;
    status: 'verified';
    verifiedAt: Date;
}

@Injectable()
export class OrderCheckinService {
    private readonly logger = new Logger(OrderCheckinService.name);
    private readonly ttlMs: number;
    private readonly distanceMeters: number;

    constructor(
        private readonly orderCheckinRepository: OrderCheckinRepository,
        private readonly orderRepository: OrderRepository,
        private readonly orderService: OrderService,
        private readonly geoLocationService: GeoLocationService,
        private readonly configService: ConfigService,
    ) {
        this.ttlMs =
            this.resolveNumber('ORDER_CHECKIN_EXPIRE_MINUTES', 15) * 60 * 1000;
        this.distanceMeters = this.resolveNumber(
            'ORDER_CHECKIN_DISTANCE_METERS',
            150,
        );
    }

    async generateQrCode(request: {
        requesterId: string;
        orderId: string;
    }): Promise<GenerateQrResult> {
        const order = await this.orderRepository.getOrderById(request.orderId);
        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        if (order.customerId !== request.requesterId) {
            throw new ForbiddenException('无权为该订单生成完成确认码');
        }

        if (order.status !== 'paid') {
            throw new BadRequestException(
                '当前订单状态不允许生成完成确认码',
            );
        }

        await this.orderCheckinRepository.revokePending(request.orderId);

        const token = randomBytes(24).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + this.ttlMs);

        await this.orderCheckinRepository.create({
            orderId: request.orderId,
            tokenHash,
            expiresAt,
        });

        const payload = this.buildPayload(request.orderId, token);
        const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
            errorCorrectionLevel: 'M',
            margin: 1,
            scale: 6,
        });

        return {
            orderId: request.orderId,
            token,
            expiresAt,
            ttlSeconds: Math.floor(this.ttlMs / 1000),
            qrCodeDataUrl,
            payload,
        };
    }

    async verifyCompletionConfirmation(
        dto: VerifyOrderCheckinDto & { staffId: string },
    ): Promise<VerifyResult> {
        const tokenHash = createHash('sha256').update(dto.token).digest('hex');
        const record =
            await this.orderCheckinRepository.findByTokenHash(tokenHash);

        if (!record) {
            throw new BadRequestException('二维码无效');
        }

        if (record.status !== 'pending') {
            throw new BadRequestException('二维码已被使用或撤销');
        }

        if (record.expiresAt <= new Date()) {
            await this.orderCheckinRepository.updateStatus(
                record.id,
                'expired',
                {
                    verifiedAt: null,
                    verifiedBy: null,
                    verifiedGeom: null,
                },
            );
            throw new BadRequestException('二维码已过期');
        }

        if (dto.orderId && dto.orderId !== record.orderId) {
            throw new BadRequestException('订单信息不匹配');
        }

        const order = await this.orderRepository.getOrderById(record.orderId);
        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        const assignedStaffId = order.assignment?.servicePersonnel?.userId;
        if (!assignedStaffId) {
            throw new BadRequestException('订单尚未分配服务人员');
        }

        if (assignedStaffId !== dto.staffId) {
            throw new ForbiddenException('当前服务人员无权确认该订单完成');
        }

        if (order.status !== 'paid') {
            throw new BadRequestException(
                '订单必须处于待服务状态才能完成确认',
            );
        }

        const userPoint = this.geoLocationService.createUserPoint(
            dto.longitude,
            dto.latitude,
        );
        const distanceDegrees = this.geoLocationService.metersToDegrees(
            this.distanceMeters,
        );
        await this.orderCheckinRepository.isWithinRange(
            record.orderId,
            userPoint,
            distanceDegrees,
        );

        // if (!withinRange) {
        //     throw new BadRequestException('尚未到达服务地点附近');
        // }

        const verifiedAt = new Date();
        await this.orderRepository.transaction(async (tx) => {
            const verified = await this.orderCheckinRepository.markPendingVerified(
                record.id,
                {
                    verifiedAt,
                    verifiedBy: dto.staffId,
                    verifiedGeom: userPoint,
                },
                tx,
            );

            if (!verified) {
                throw new BadRequestException('二维码已被使用或撤销');
            }

            await this.orderRepository.completeOrderAndIncrementServicedCount(
                record.orderId,
                tx,
            );
        });

        await this.orderService.handleOrderCompletionSideEffects(
            record.orderId,
            order,
        );

        return {
            orderId: record.orderId,
            status: 'verified',
            verifiedAt,
        };
    }

    private buildPayload(orderId: string, token: string): OrderCheckinPayload {
        return { orderId, token };
    }

    async verifyCheckIn(
        dto: VerifyOrderCheckinDto & { staffId: string },
    ): Promise<VerifyResult> {
        return await this.verifyCompletionConfirmation(dto);
    }

    private resolveNumber(key: string, fallback: number): number {
        const raw = this.configService.get<string>(key);
        if (!raw) {
            return fallback;
        }

        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        this.logger.warn(`${key} 配置无效，回退到默认值 ${fallback}`);
        return fallback;
    }
}
