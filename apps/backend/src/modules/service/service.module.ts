import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { ServiceRepository } from './service.repository';

@Module({
    controllers: [ServiceController],
    providers: [ServiceService, ServiceRepository],
})
export class ServiceModule {}
