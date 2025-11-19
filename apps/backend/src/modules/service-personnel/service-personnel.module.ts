import { Module } from '@nestjs/common';
import { GeoLocationService } from 'src/common/services/geo-location.service';
import { OrderRepository } from '../order/order.reposityro';
import { ServicePersonnelController } from './service-personnel.controller';
import { ServicePersonnelRepository } from './service-personnel.repository';
import { ServicePersonnelService } from './service-personnel.service';
import { WorkSkillModule } from '../work-skill/work-skill.module';
import { FilesModule } from '../files/files.module';
import { PayModule } from '../pay/pay.module';
import { ReviewModule } from '../review/review.module';

@Module({
    imports: [WorkSkillModule, FilesModule, PayModule, ReviewModule],
    controllers: [ServicePersonnelController],
    providers: [
        ServicePersonnelService,
        ServicePersonnelRepository,
        GeoLocationService,
        OrderRepository,
    ],
    exports: [ServicePersonnelService],
})
export class ServicePersonnelModule {}
