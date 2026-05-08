import { Module } from '@nestjs/common';
import { UserAuthRealNameService } from './user-auth-real-name.service';
import { UserAuthRealNameController } from './user-auth-real-name.controller';
import { UserAuthRealNameRepository } from './user-auth-real-name-repository';
import { AlipayFaceCertifyClient } from './alipay-face-certify.client';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [FilesModule],
    controllers: [UserAuthRealNameController],
    providers: [
        UserAuthRealNameService,
        UserAuthRealNameRepository,
        AlipayFaceCertifyClient,
    ],
})
export class UserAuthRealNameModule {}
