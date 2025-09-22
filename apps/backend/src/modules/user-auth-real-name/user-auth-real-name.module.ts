import { Module } from "@nestjs/common";
import { UserAuthRealNameService } from "./user-auth-real-name.service";
import { UserAuthRealNameController } from "./user-auth-real-name.controller";
import { UserAuthRealNameRepository } from "./user-auth-real-name-repository";

@Module({
	controllers: [UserAuthRealNameController],
	providers: [UserAuthRealNameService, UserAuthRealNameRepository],
})
export class UserAuthRealNameModule {}
