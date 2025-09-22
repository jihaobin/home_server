import { Module } from "@nestjs/common";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";
import { OrderRepository } from "./order.reposityro";
import { ServiceModule } from "../service/service.module";
import { WorkSkillModule } from "../work-skill/work-skill.module";

@Module({
	controllers: [OrderController],
	providers: [OrderService, OrderRepository],
	imports: [ServiceModule, WorkSkillModule],
})
export class OrderModule {}
