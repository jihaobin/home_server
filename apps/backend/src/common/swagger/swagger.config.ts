import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import {
    OpenAPIRegistry,
    OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';

/**
 * 转换 NestJS 服务器对象为 openapi3-ts 兼容格式
 * 解决两个库之间的类型兼容性问题
 */
function convertServersToOpenApiFormat(servers: any[]): any[] {
    return servers.map((server) => ({
        url: server.url,
        description: server.description,
        // 只包含基本属性，避免 variables 类型冲突
        ...(server.variables &&
            Object.keys(server.variables).length > 0 && {
                variables: Object.fromEntries(
                    Object.entries(server.variables).map(
                        ([key, value]: [string, any]) => [
                            key,
                            {
                                default: value.default,
                                description: value.description,
                                enum: value.enum,
                            },
                        ],
                    ),
                ),
            }),
    }));
}

/**
 * Swagger 配置类
 * 负责设置 OpenAPI 文档的基本信息和配置
 */
export class SwaggerConfig {
    private static registry = new OpenAPIRegistry();

    /**
     * 获取 OpenAPI 注册表实例
     * 用于注册 Zod schemas 到 OpenAPI 规范
     */
    static getRegistry(): OpenAPIRegistry {
        return this.registry;
    }

    /**
     * 配置 Swagger 文档
     * @param app NestJS 应用实例
     * @param options 配置选项
     */
    static setup(
        app: INestApplication,
        options?: {
            title?: string;
            description?: string;
            version?: string;
            path?: string;
            enableAuth?: boolean;
        },
    ) {
        const {
            title = 'Cow Course API',
            description = `Cow Course 平台 API 文档

## 认证说明

本 API 使用 Better-Auth 库提供认证功能，认证端点由 Better-Auth 自动生成和管理：

### 认证端点
- **登录**: \`POST /api/auth/sign-in/email\`
- **注册**: \`POST /api/auth/sign-up/email\`
- **登出**: \`POST /api/auth/sign-out\`
- **获取会话**: \`GET /api/auth/session\`

### 认证方式
- 使用 Cookie + Session 进行身份验证
- 会话数据存储在数据库中
- 登录成功后会自动设置 session cookie

### 使用方法
1. 通过 Better-Auth 端点进行登录/注册
2. 登录成功后，后续请求会自动携带 session cookie
3. 需要认证的 API 端点会验证 session 有效性

**注意**: 本文档中的 API 端点不包含认证相关的端点，这些由 Better-Auth 自动提供。`,
            version = '1.0.0',
            path = 'api-docs',
            enableAuth = true,
        } = options || {};

        // 创建基础 Swagger 配置
        const config = new DocumentBuilder()
            .setTitle(title)
            .setDescription(description)
            .setVersion(version)
            .addServer('http://localhost:5050', '开发环境')
            .addServer('https://api.cow-course.com', '生产环境');

        // 如果启用认证，添加 Cookie 认证配置
        if (enableAuth) {
            config.addCookieAuth('session', {
                type: 'apiKey',
                in: 'cookie',
                name: 'session',
                description:
                    'Session cookie authentication - 基于数据库存储的会话认证',
            });
        }

        // 构建文档
        const document = config.build();

        // 生成 Zod schemas 的 OpenAPI 定义
        const generator = new OpenApiGeneratorV3(this.registry.definitions);
        const zodOpenApiDocument = generator.generateDocument({
            openapi: '3.0.0',
            info: {
                title: title,
                version: version,
                description: description,
            },
            servers: convertServersToOpenApiFormat(document.servers || []),
        });

        // 合并 NestJS 和 Zod 生成的文档
        const nestDocument = SwaggerModule.createDocument(app, document);

        // 只合并 schemas，使用类型安全的方式
        if (zodOpenApiDocument.components?.schemas) {
            nestDocument.components = nestDocument.components || {};
            nestDocument.components.schemas =
                nestDocument.components.schemas || {};

            // 逐个添加 Zod schemas，避免类型冲突
            Object.entries(zodOpenApiDocument.components.schemas).forEach(
                ([key, schema]) => {
                    if (nestDocument.components?.schemas) {
                        (nestDocument.components.schemas as any)[key] = schema;
                    }
                },
            );
        }

        // 设置 Swagger UI
        SwaggerModule.setup(path, app, nestDocument, {
            swaggerOptions: {
                persistAuthorization: true,
                displayRequestDuration: true,
                docExpansion: 'none',
                filter: true,
                showRequestHeaders: true,
                tryItOutEnabled: true,
            },
            customSiteTitle: `${title} - API Documentation`,
            customfavIcon: '/favicon.ico',
            customJs: [
                'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
            ],
            customCssUrl: [
                'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
            ],
        });

        console.log(`📚 Swagger UI 已启动: http://localhost:5050/${path}`);
        console.log(`📄 OpenAPI JSON: http://localhost:5050/${path}-json`);
    }

    /**
     * 注册 Zod schema 到 OpenAPI
     * @param name Schema 名称
     * @param schema Zod schema
     */
    static registerSchema(name: string, schema: any) {
        this.registry.register(name, schema);
    }

    /**
     * 注册 API 路径到 OpenAPI
     * @param path 路径配置
     */
    static registerPath(path: any) {
        this.registry.registerPath(path);
    }
}
