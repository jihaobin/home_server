import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ServiceModule } from '../service/service.module';
import { GeoLocationService } from 'src/common/services/geo-location.service';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { HomeRepository } from './home.repository';

@Module({
    imports: [FilesModule, ServiceModule],
    controllers: [HomeController],
    providers: [HomeService, HomeRepository, GeoLocationService],
})
export class HomeModule {}
