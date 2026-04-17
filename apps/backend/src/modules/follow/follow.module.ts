import { Module } from '@nestjs/common';
import { FollowController } from './follow.controller';
import { FollowRepository } from './follow.repository';
import { FollowService } from './follow.service';

@Module({
    controllers: [FollowController],
    providers: [FollowRepository, FollowService],
    exports: [FollowService],
})
export class FollowModule {}
