import { Module } from "@nestjs/common";
import { ServiceModule } from "../service/service.module";
import { WorkSkillModule } from "../work-skill/work-skill.module";
import { OrderController } from "./order.controller";
import { OrderRepository } from "./order.reposityro";
import { OrderService } from "./order.service";

@Module({
	controllers: [OrderController],
	providers: [OrderService, OrderRepository],
	imports: [ServiceModule, WorkSkillModule],
	exports: [OrderService],
})
export class OrderModule {}
