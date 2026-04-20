import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FollowController } from './follow.controller';
import { FollowRepository } from './follow.repository';
import { FollowService } from './follow.service';

@Module({
    imports: [FilesModule],
    controllers: [FollowController],
    providers: [FollowRepository, FollowService],
    exports: [FollowService],
})
export class FollowModule {}
