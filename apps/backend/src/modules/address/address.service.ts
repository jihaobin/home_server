import { Inject, Injectable } from '@nestjs/common';
import { AddressQuery } from '@repo/types';
import { AddressRespository } from './address.repository';

@Injectable()
export class AddressService {
    @Inject()
    private readonly addressRepository: AddressRespository;

    findAll(query: AddressQuery) {
        return this.addressRepository.find(query);
    }
}
