import { Module } from '@nestjs/common';

import DatabaseModule from 'src/common/database/database.module';
import { FilesModule } from '../files/files.module';
import { AppReleaseRepository } from './app-release.repository';
import { AppReleaseService } from './app-release.service';
import { AdminAppReleaseController } from './admin-app-release.controller';
import { AppUpdateController } from './app-update.controller';
import { AppDownloadController } from './app-download.controller';

@Module({
    imports: [DatabaseModule, FilesModule],
    controllers: [
        AdminAppReleaseController,
        AppUpdateController,
        AppDownloadController,
    ],
    providers: [AppReleaseRepository, AppReleaseService],
    exports: [AppReleaseRepository, AppReleaseService],
})
export class AppReleaseModule {}
