import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/exceptions';
import { AppLoggerService } from './common/logger';
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

    app.setGlobalPrefix('api', {
        exclude: [
            '/api/auth/{*path}',
            { path: 'file/apk/:app', method: RequestMethod.GET },
        ],
    });
    await app.listen(process.env.PORT ?? 5050);
}
void bootstrap();
