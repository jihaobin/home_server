import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { SwaggerModels } from "./common/swagger/swagger-models";

export function setupScalarSwagger(app: INestApplication) {
	const config = new DocumentBuilder()
		.setTitle("后端 API 文档 - Scalar")
		.setDescription(
			`Cow Course 平台 API 文档

## 认证说明

本 API 使用 Better-Auth 库提供认证功能，认证端点由 Better-Auth 自动生成和管理(详情请查看这个路径 /api/auth/reference)

### 认证方式

- 使用 Cookie + Session 进行身份验证
- 会话数据存储在数据库中
- 登录成功后会自动设置 session cookie

### 使用方法

1. 通过 Better-Auth 端点进行登录/注册
2. 登录成功后，后续请求会自动携带 session cookie
3. 需要认证的 API 端点会验证 session 有效性

**注意**: 本文档中的 API 端点不包含认证相关的端点，这些由 Better-Auth 自动提供。

## 公共数据模型

本 API 使用统一的响应格式和数据模型，所有响应都遵循以下规范：

### 基础响应格式
- **BaseResponse**: 所有API响应的基础格式
- **SuccessResponse**: 成功响应格式，包含实际数据
- **ErrorResponse**: 错误响应格式，包含错误信息

### 分页相关模型
- **PaginationMeta**: 分页元数据信息
- **PaginatedData**: 分页数据格式
- **PaginatedResponse**: 分页响应格式
- **PaginationQuery**: 分页查询参数

### 状态码和错误码
- **ApiStatusCode**: API响应状态码枚举
- **ErrorCode**: 详细错误代码枚举

这些模型在下方的 "Models" 部分有详细定义，可供参考。`,
		)
		.setVersion("1.0")
		.addCookieAuth("session", {
			type: "apiKey",
			in: "cookie",
			name: "session",
			description: "Session cookie authentication - 基于数据库存储的会话认证",
		})
		.addServer("http://localhost:5050/api", "开发环境")
		.addServer("https://api.cow-course.com/api", "生产环境")
		.build();

	const document = SwaggerModule.createDocument(app, config);

	// 添加公共模型到文档中
	SwaggerModels.addToDocument(document);

	app.use(
		"/api-docs",
		apiReference({
			content: document,
		}),
	);
}
