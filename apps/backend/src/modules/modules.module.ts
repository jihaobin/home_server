import { Module } from '@nestjs/common';
import { AddressModule } from './address/address.module';
import { UserAuthRealNameModule } from './user-auth-real-name/user-auth-real-name.module';

@Module({
    imports: [AddressModule, UserAuthRealNameModule],
})
export class ModulesModule {}
