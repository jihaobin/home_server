import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, S3StoreServer],
  exports: [FilesService],
})
export class FilesModule {}
