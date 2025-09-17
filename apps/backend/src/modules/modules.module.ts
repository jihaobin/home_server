import { Module } from '@nestjs/common';
import { AddressModule } from './address/address.module';
import { UserAuthRealNameModule } from './user-auth-real-name/user-auth-real-name.module';
import { ServiceModule } from './service/service.module';
import { WorkSkillModule } from './work-skill/work-skill.module';
import { ServicePersonnelModule } from './service-personnel/service-personnel.module';
import { OrderModule } from './order/order.module';

@Module({
    imports: [
        AddressModule,
        UserAuthRealNameModule,
        ServiceModule,
        WorkSkillModule,
        ServicePersonnelModule,
        OrderModule,
    ],
})
export class ModulesModule {}
