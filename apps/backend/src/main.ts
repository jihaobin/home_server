import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// 确保 Zod OpenAPI 扩展在导入时执行
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { AppLoggerService } from './common/logger';
import { HttpExceptionFilter } from './common/exceptions';

// 立即扩展 Zod
extendZodWithOpenApi(z);

const trustedOrigins = (process.env.TRUSTED_ORIGINS as string).split(',');

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bodyParser: false,
    });

    app.enableCors({
        origin: trustedOrigins,
        credentials: true,
    });

    const logger = await app.resolve(AppLoggerService);
    logger.setContext('Bootstrap');
    app.useLogger(logger);

    app.useGlobalFilters(new HttpExceptionFilter(logger));

    app.setGlobalPrefix('api', { exclude: ['/api/auth/{*path}'] });
    await app.listen(process.env.PORT ?? 5050);
}
void bootstrap();
