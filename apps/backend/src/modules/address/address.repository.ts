import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
    AddressQuery,
    CreateUserAddress,
    UpdateUserAddress,
    UserAddresses,
} from '@repo/types';
import { and, eq } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import { userAddresses } from 'src/common/database/schema';

@Injectable()
export class AddressRespository {
    @Inject(DB)
    private readonly db: DbType;

    private async isAddressExistsById(id: string): Promise<boolean> {
        const result = await this.db.query.userAddresses.findFirst({
            where: (table, { eq }) => eq(table.id, id),
            columns: { id: true },
        });
        return !!result;
    }

    find(query: AddressQuery) {
        switch (query.filter) {
            case 'all':
                return this.db.query.chinaCity.findMany();
            case 'province':
                return this.db.query.chinaCity.findMany({
                    where: (chinaCity, { eq }) => eq(chinaCity.deep, 0),
                });
            case 'city':
                return this.db.query.chinaCity.findMany({
                    where: (chinaCity, { eq }) => eq(chinaCity.deep, 1),
                });
            case 'area':
                return this.db.query.chinaCity.findMany({
                    where: (chinaCity, { eq }) => eq(chinaCity.deep, 2),
                });
            default:
                return this.db.query.chinaCity.findMany();
        }
    }

    async createAddress(data: CreateUserAddress) {
        if (!data.userId) {
            throw new BadRequestException('创建地址必须传入 userId');
        }

        if (!data.recipientPhone) {
            throw new BadRequestException('创建地址必须传入手机号');
        }

        return this.db.insert(userAddresses).values({
            ...data,
            geom: [data.lng, data.lat],
        });
    }

    async updateAddress(id: string, data: UpdateUserAddress) {
        if (!(await this.isAddressExistsById(id))) {
            throw new BadRequestException('当前该收货地址不存在');
        }

        // 仅更新表字段，避免把请求层的 lat/lng/id 等无关字段写进 SQL。
        const updatePayload: Partial<typeof userAddresses.$inferInsert> = {};

        if (data.detailedAddress !== undefined) {
            updatePayload.detailedAddress = data.detailedAddress;
        }
        if (data.addressName !== undefined) {
            updatePayload.addressName = data.addressName;
        }
        if (data.homeNumber !== undefined) {
            updatePayload.homeNumber = data.homeNumber;
        }
        if (data.province !== undefined) {
            updatePayload.province = data.province;
        }
        if (data.city !== undefined) {
            updatePayload.city = data.city;
        }
        if (data.district !== undefined) {
            updatePayload.district = data.district;
        }
        if (data.recipientName !== undefined) {
            updatePayload.recipientName = data.recipientName;
        }
        if (data.sex !== undefined) {
            updatePayload.sex = data.sex;
        }
        if (data.recipientPhone !== undefined) {
            updatePayload.recipientPhone = data.recipientPhone;
        }
        if (data.isDefault !== undefined) {
            updatePayload.isDefault = data.isDefault;
        }
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
            updatePayload.geom = [data.lng, data.lat];
        }

        return this.db
            .update(userAddresses)
            .set(updatePayload)
            .where(
                data.userId
                    ? and(
                          eq(userAddresses.id, id),
                          eq(userAddresses.userId, data.userId),
                      )
                    : eq(userAddresses.id, id),
            );
    }

    async deleteAddress(id: string) {
        if (!(await this.isAddressExistsById(id))) {
            throw new BadRequestException('当前该收货地址不存在');
        }
        return this.db.delete(userAddresses).where(eq(userAddresses.id, id));
    }

    async findByUserId(id: string): Promise<UserAddresses[]> {
        const response = await this.db.query.userAddresses.findMany({
            where: (userAddresses, { eq }) => eq(userAddresses.userId, id),
        });

        return response.map((item) => ({
            ...item,
            addressName: item.addressName ?? '',
            homeNumber: item.homeNumber ?? '',
            city: item.city ?? '',
            district: item.district ?? '',
            geom: item.geom as number[] | undefined,
        }));
    }

    async findByIdAndUserId(
        addressId: string,
        userId: string,
    ): Promise<UserAddresses | null> {
        const response = await this.db.query.userAddresses.findFirst({
            where: and(
                eq(userAddresses.id, addressId),
                eq(userAddresses.userId, userId),
            ),
        });

        if (!response) {
            return null;
        }

        return {
            ...response,
            addressName: response.addressName ?? '',
            homeNumber: response.homeNumber ?? '',
            city: response.city ?? '',
            district: response.district ?? '',
            geom: response.geom as number[] | undefined,
        };
    }

    async findDefaultByUserId(userId: string): Promise<UserAddresses | null> {
        const response = await this.db.query.userAddresses.findFirst({
            where: and(
                eq(userAddresses.userId, userId),
                eq(userAddresses.isDefault, true),
            ),
        });

        if (!response) {
            return null;
        }

        return {
            ...response,
            addressName: response.addressName ?? '',
            homeNumber: response.homeNumber ?? '',
            city: response.city ?? '',
            district: response.district ?? '',
            geom: response.geom as number[] | undefined,
        };
    }
}
