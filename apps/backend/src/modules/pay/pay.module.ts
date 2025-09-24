import { Module } from "@nestjs/common";
import { OrderModule } from "../order/order.module";
import { PayController } from "./pay.controller";
import { PayRepository } from "./pay.repository";
import { PayService } from "./pay.service";

@Module({
	controllers: [PayController],
	providers: [PayService, PayRepository],
	imports: [OrderModule],
})
export class PayModule {}
