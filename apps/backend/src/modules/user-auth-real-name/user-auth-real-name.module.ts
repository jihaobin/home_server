import { Module } from '@nestjs/common';
import { UserAuthRealNameService } from './user-auth-real-name.service';
import { UserAuthRealNameController } from './user-auth-real-name.controller';

@Module({
  controllers: [UserAuthRealNameController],
  providers: [UserAuthRealNameService],
})
export class UserAuthRealNameModule {}
