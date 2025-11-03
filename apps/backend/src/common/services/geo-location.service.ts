import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

export interface Coordinates {
    latitude: number;
    longitude: number;
}

@Injectable()
export class GeoLocationService {
    /**
     * 🛡️ 验证坐标有效性
     */
    validateCoordinates(lat: number, lng: number): void {
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            throw new Error('Coordinates must be numbers');
        }

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('Coordinates cannot be NaN');
        }

        if (lat < -90 || lat > 90) {
            throw new Error(
                `Invalid latitude: ${lat}. Must be between -90 and 90.`,
            );
        }

        if (lng < -180 || lng > 180) {
            throw new Error(
                `Invalid longitude: ${lng}. Must be between -180 and 180.`,
            );
        }
    }

    /**
     * 🎯 创建用户位置点（SRID 4326）
     */
    createUserPoint(lng: number, lat: number): SQL {
        this.validateCoordinates(lat, lng);
        return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    }

    /**
     * ⚡ 创建索引友好的距离过滤条件
     * 使用ST_DWithin可以有效利用GIST空间索引
     *
     * 注意：对于SRID 4326，ST_DWithin使用度数作为单位
     * 1度约等于111公里，所以我们需要将公里转换为度数
     */
    createDistanceFilter(
        geomColumn: SQL,
        userPoint: SQL,
        maxDistanceKm: number,
    ): SQL {
        // 粗略转换：1度 ≈ 111公里
        // 为了确保不遗漏边缘情况，我们使用稍大的值
        const maxDistanceDegrees = maxDistanceKm / 100; // 保守估计，避免遗漏

        return sql`ST_DWithin(ST_SetSRID(${geomColumn}, 4326), ${userPoint}, ${maxDistanceDegrees})`;
    }

    /**
     * 📏 创建精确的球面距离计算公式
     * 使用ST_DistanceSphere计算球面距离，返回米为单位
     */
    createDistanceCalculation(geomColumn: SQL, userPoint: SQL): SQL {
        return sql`ST_DistanceSphere(${geomColumn}, ${userPoint}) / 1000`;
    }

    /**
     * 🚀 创建高性能的组合查询条件
     * 先用ST_DWithin进行索引友好的粗筛选，再用精确距离计算
     */
    createOptimizedDistanceCondition(
        geomColumn: SQL,
        userPoint: SQL,
        maxDistanceKm: number,
    ): {
        fastFilter: SQL;
        exactDistance: SQL;
        exactFilter: SQL;
    } {
        const fastFilter = this.createDistanceFilter(
            geomColumn,
            userPoint,
            maxDistanceKm,
        );
        const exactDistance = this.createDistanceCalculation(
            geomColumn,
            userPoint,
        );
        const exactFilter = sql`${exactDistance} <= ${maxDistanceKm}`;

        return {
            fastFilter,
            exactDistance,
            exactFilter,
        };
    }

    /**
     * 🔄 转换度数到米（粗略估算）
     */
    degreesToMeters(degrees: number): number {
        return degrees * 111000; // 1度约等于111公里
    }

    /**
     * 🔄 转换米到度数（粗略估算）
     */
    metersToDegrees(meters: number): number {
        return meters / 111000;
    }
}
