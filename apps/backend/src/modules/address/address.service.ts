import { Inject, Injectable } from '@nestjs/common';
import {
    AddressQuery,
    UpdateUserAddress,
    CreateUserAddress,
} from '@repo/types';
import { AddressRespository } from './address.repository';

@Injectable()
export class AddressService {
    @Inject()
    private readonly addressRepository: AddressRespository;

    findAll(query: AddressQuery) {
        return this.addressRepository.find(query);
    }

    updateAddress(id: string, data: UpdateUserAddress) {
        return this.addressRepository.updateAddress(id, data);
    }

    createAddress(data: CreateUserAddress) {
        return this.addressRepository.createAddress(data);
    }

    deleteAddress(id: string) {
        this.addressRepository.deleteAddress(id);
        return '删除成功';
    }

    getAddressByUserId(id: string) {
        return this.addressRepository.findByUserId(id);
    }
}
