import { Module } from "@nestjs/common";
import { AddressService } from "./address.service";
import { AddressController } from "./address.controller";
import { AddressRespository } from "./address.repository";

@Module({
	controllers: [AddressController],
	providers: [AddressService, AddressRespository],
})
export class AddressModule {}
