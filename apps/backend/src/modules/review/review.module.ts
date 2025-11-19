import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ReviewRepository } from './review.repository';
import { FilesService } from '../files/files.service';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [FilesModule],
    controllers: [ReviewController],
    providers: [ReviewService, ReviewRepository, FilesService],
    exports: [ReviewService],
})
export class ReviewModule {}
