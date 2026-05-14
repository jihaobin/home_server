import { Module } from '@nestjs/common';
import { WorkSkillService } from './work-skill.service';
import { WorkSkillController } from './work-skill.controller';
import { WorkSkillRepository } from './work-skill.repository';
import { NotificationModule } from '../notification/notification.module';
import { FilesModule } from '../files/files.module';
import { FilesService } from '../files/files.service';
import { AdminServiceOfferingsController } from './admin-service-offerings.controller';
import {
    ADMIN_SERVICE_OFFERINGS_FILES_SERVICE,
    AdminServiceOfferingsRepository,
} from './admin-service-offerings.repository';
import { AdminServiceOfferingsService } from './admin-service-offerings.service';

@Module({
    imports: [NotificationModule, FilesModule],
    controllers: [WorkSkillController, AdminServiceOfferingsController],
    providers: [
        WorkSkillService,
        WorkSkillRepository,
        AdminServiceOfferingsService,
        AdminServiceOfferingsRepository,
        {
            provide: ADMIN_SERVICE_OFFERINGS_FILES_SERVICE,
            useExisting: FilesService,
        },
    ],
    exports: [WorkSkillService],
})
export class WorkSkillModule {}
