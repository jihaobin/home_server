import {
    MiddlewareConsumer,
    Module,
    NestModule,
    RequestMethod,
} from '@nestjs/common';
import { AdminSessionMiddleware } from '../auth/admin-session.middleware';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminSeedService } from './admin-seed.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardRepository } from './admin-dashboard.repository';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersRepository } from './admin-users.repository';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersRepository } from './admin-orders.repository';
import { OrderModule } from '../order/order.module';
import { FilesModule } from '../files/files.module';
import { AdminServiceCategoriesController } from './admin-service-categories.controller';
import { AdminServiceCategoriesService } from './admin-service-categories.service';
import { AdminServiceCategoriesRepository } from './admin-service-categories.repository';
import { AdminHomeConfigController } from './admin-home-config.controller';
import { AdminHomeConfigService } from './admin-home-config.service';
import { AdminHomeConfigRepository } from './admin-home-config.repository';
import { AdminServiceCategoryCommissionStrategyController } from './admin-service-category-commission-strategy.controller';
import { AdminServiceCategoryCommissionStrategyService } from './admin-service-category-commission-strategy.service';
import { AdminServiceCategoryCommissionStrategyRepository } from './admin-service-category-commission-strategy.repository';
import { AdminServiceTagsController } from './admin-service-tags.controller';
import { AdminServiceTagsService } from './admin-service-tags.service';
import { AdminServiceTagsRepository } from './admin-service-tags.repository';
import { AdminMerchantJoinRequestsController } from './admin-merchant-join-requests.controller';
import { AdminMerchantJoinRequestsService } from './admin-merchant-join-requests.service';
import { AdminMerchantJoinRequestsRepository } from './admin-merchant-join-requests.repository';

@Module({
    imports: [OrderModule, FilesModule],
    controllers: [
        AdminAuthController,
        AdminDashboardController,
        AdminUsersController,
        AdminOrdersController,
        AdminServiceCategoriesController,
        AdminServiceTagsController,
        AdminMerchantJoinRequestsController,
        AdminHomeConfigController,
        AdminServiceCategoryCommissionStrategyController,
    ],
    providers: [
        AdminAuthService,
        AdminSeedService,
        AdminDashboardService,
        AdminDashboardRepository,
        AdminUsersService,
        AdminUsersRepository,
        AdminOrdersService,
        AdminOrdersRepository,
        AdminServiceCategoriesService,
        AdminServiceCategoriesRepository,
        AdminServiceTagsService,
        AdminServiceTagsRepository,
        AdminMerchantJoinRequestsService,
        AdminMerchantJoinRequestsRepository,
        AdminHomeConfigService,
        AdminHomeConfigRepository,
        AdminServiceCategoryCommissionStrategyService,
        AdminServiceCategoryCommissionStrategyRepository,
    ],
})
export class AdminModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(AdminSessionMiddleware)
            .exclude({ path: 'admin/login', method: RequestMethod.POST })
            .forRoutes({ path: 'admin/(.*)', method: RequestMethod.ALL });
    }
}
