import { Module } from '@nestjs/common';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';
import { FileCleanupTask } from './file-cleanup.task';
import { FileValidatorService } from './file-validator.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ThumbnailService } from './thumbnail.service';

@Module({
    imports: [],
    controllers: [FilesController],
    providers: [
        FilesService,
        FileValidatorService,
        FileCleanupTask,
        S3StoreServer,
        ThumbnailService,
    ],
    exports: [
        FilesService,
        FilesService,
        FileValidatorService,
        FileCleanupTask,
        S3StoreServer,
        ThumbnailService,
    ],
})
export class FilesModule {}
