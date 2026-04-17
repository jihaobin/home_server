import { Module } from '@nestjs/common';
import { AddressModule } from './address/address.module';
import { UserAuthRealNameModule } from './user-auth-real-name/user-auth-real-name.module';
import { ServiceModule } from './service/service.module';
import { WorkSkillModule } from './work-skill/work-skill.module';
import { ServicePersonnelModule } from './service-personnel/service-personnel.module';
import { OrderModule } from './order/order.module';
import { PayModule } from './pay/pay.module';
import { FilesModule } from './files/files.module';
import { ReviewModule } from './review/review.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';
import { AppReleaseModule } from './app-release/app-release.module';
import { HomeModule } from './home/home.module';
import { ChatModule } from './chat/chat.module';
import { FollowModule } from './follow/follow.module';
import { MassageModule } from './massage/massage.module';

@Module({
    imports: [
        AddressModule,
        UserAuthRealNameModule,
        ServiceModule,
        WorkSkillModule,
        ServicePersonnelModule,
        OrderModule,
        PayModule,
        FilesModule,
        ReviewModule,
        NotificationModule,
        ChatModule,
        AppReleaseModule,
        HomeModule,
        FollowModule,
        MassageModule,
        AdminModule,
    ],
})
export class ModulesModule {}
