import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/exceptions';
import { AppLoggerService } from './common/logger';
import { setupScalarSwagger } from './swagger-scalar.setup';

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bodyParser: false,
    });

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) {
                // 非浏览器场景直接放行
                return callback(null, true);
            }
            const normalized = origin.replace(/\/$/, '');
            if (trustedOrigins.includes(normalized)) {
                return callback(null, true);
            }
            return callback(new Error(`Not allowed by CORS: ${origin}`), false);
        },
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
