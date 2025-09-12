import { Module } from '@nestjs/common';
import { ServicePersonnelService } from './service-personnel.service';
import { ServicePersonnelController } from './service-personnel.controller';
import { ServicePersonnelRepository } from './service-personnel.repository';
import { GeoLocationService } from 'src/common/services/geo-location.service';

@Module({
    controllers: [ServicePersonnelController],
    providers: [
        ServicePersonnelService,
        ServicePersonnelRepository,
        GeoLocationService,
    ],
    exports: [ServicePersonnelService],
})
export class ServicePersonnelModule {}
