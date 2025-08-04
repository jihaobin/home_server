import { Inject, Injectable } from '@nestjs/common';
import { AddressQuery } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';

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
}
