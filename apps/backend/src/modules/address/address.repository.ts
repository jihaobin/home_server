import { Inject, Injectable } from '@nestjs/common';
import {
    AddressQuery,
    CreateUserAddress,
    UpdateUserAddress,
} from '@repo/types';
import { eq } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import { userAddresses } from 'src/common/database/schema';

@Injectable()
export class AddressRespository {
    @Inject(DB)
    private readonly db: DbType;

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

    createAddress(data: CreateUserAddress) {
        return this.db.insert(userAddresses).values({
            ...data,
            geom: [data.lat, data.lng],
        });
    }

    updateAddress(id: string, data: UpdateUserAddress) {
        return this.db
            .update(userAddresses)
            .set({
                ...data,
                ...(data.lat && data.lng ? { geom: [data.lat, data.lng] } : {}),
            })
            .where(eq(userAddresses.userId, id));
    }

    deleteAddress(id: string) {
        return this.db.delete(userAddresses).where(eq(userAddresses.id, id));
    }

    findByUserId(id: string) {
        return this.db.query.userAddresses.findFirst({
            where: (userAddresses, { eq }) => eq(userAddresses.userId, id),
        });
    }
}
