import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FollowModule } from '../follow/follow.module';
import { HomeModule } from '../home/home.module';
import { OrderRepository } from '../order/order.reposityro';
import { ReviewModule } from '../review/review.module';
import { ServicePersonnelModule } from '../service-personnel/service-personnel.module';
import { MassageController } from './massage.controller';
import { MassageRepository } from './massage.repository';
import { MassageService } from './massage.service';

@Module({
    imports: [
        FilesModule,
        FollowModule,
        HomeModule,
        ReviewModule,
        ServicePersonnelModule,
    ],
    controllers: [MassageController],
    providers: [MassageRepository, MassageService, OrderRepository],
})
export class MassageModule {}
