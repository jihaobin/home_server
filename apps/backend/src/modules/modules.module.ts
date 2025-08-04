import { Module } from '@nestjs/common';
import { AddressModule } from './address/address.module';

@Module({
    imports: [AddressModule],
})
export class ModulesModule {}
