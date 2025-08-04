import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLoggerService } from './common/logger';
import { HttpExceptionFilter } from './common/exceptions';
import { setupScalarSwagger } from './swagger-scalar.setup';

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

    setupScalarSwagger(app);

    app.setGlobalPrefix('api', { exclude: ['/api/auth/{*path}'] });
    await app.listen(process.env.PORT ?? 5050);
}
void bootstrap();
