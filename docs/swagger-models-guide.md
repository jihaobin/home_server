
# Swagger 公共模型自动集成指南

本指南介绍如何在项目中自动集成和使用所有公共 Swagger 数据模型。

## 功能亮点

- **自动注册**：所有在 `packages/types` 中定义并以 `Schema` 结尾的 Zod Schema、枚举类型会自动加载到 Swagger 文档，无需手动维护列表。
- **类型安全**：所有模型均由 Zod Schema 强类型定义，自动转换为 JSON Schema，元数据（title/description/examples）也会自动集成。
- **统一响应**：所有 API 响应、分页、错误码等模型均已自动注册，Swagger UI 的 "Schemas" 区域可直接查看详细结构。

## 自动集成的模型

所有以 `Schema` 结尾的类型、枚举都会自动出现在 Swagger 文档，包括：

### 响应相关模型
- **BaseResponse**：所有 API 响应的基础格式
- **SuccessResponse**：成功响应格式
- **ErrorResponse**：错误响应格式

### 分页相关模型
- **PaginationMeta**：分页元数据
- **PaginatedData**：分页数据格式
- **PaginatedResponse**：分页响应格式
- **PaginationQuery**：分页查询参数

### 枚举模型
- **ApiStatusCode**：API 状态码枚举
- **ErrorCode**：详细错误代码枚举

### 其他模型
- 只需在 `packages/types/src/common.ts` 或其他类型文件中定义 Zod Schema，命名以 `Schema` 结尾，即可自动集成。

## 如何使用

### 1. Controller 中统一响应装饰器

推荐使用统一的响应装饰器，所有数据类型自动关联到 Swagger 模型：

```typescript
import { ApiSuccessResponse, ApiErrorResponses } from 'src/common/decorator';
import { z } from 'zod/v4';

@Controller('example')
export class ExampleController {
    @ApiOperation({ summary: '示例接口', description: '响应格式遵循 SuccessResponse 模型' })
    @ApiSuccessResponse(z.array(YourDataSchema), {
        description: '成功获取数据',
        example: {
            code: 0,
            message: '操作成功',
            data: [/* 你的数据 */],
            timestamp: Date.now()
        }
    })
    @ApiErrorResponses()
    @Get('data')
    getData() {
        return this.service.getData();
    }
}
```

### 2. 分页接口自动模型

分页接口只需声明 `isPaginated: true`，自动关联分页相关模型：

```typescript
@ApiSuccessResponse(z.array(YourItemSchema), {
    description: '分页查询成功',
    isPaginated: true,
    example: {
        code: 0,
        message: '操作成功',
        data: {
            items: [/* 数据数组 */],
            meta: {
                page: 1,
                limit: 10,
                total: 100,
                totalPages: 10,
                hasNext: true,
                hasPrev: false
            }
        },
        timestamp: Date.now()
    }
})
@Get('paginated-data')
getPaginatedData(@Query() query: PaginationQuery) {
    return this.service.getPaginatedData(query);
}
```

## 查看模型文档

1. 启动开发服务器: `pnpm dev --filter backend`
2. 访问 Swagger 文档: `http://localhost:5050/api-docs`
3. 在文档底部找到 "Schemas" 区域，所有自动注册模型均可点开查看详细定义

## 模型文件位置

- **公共类型定义**: `packages/types/src/common.ts`
- **自动注册与转换**: `apps/backend/src/common/swagger/swagger-models.ts`
- **响应装饰器**: `apps/backend/src/common/decorator/api-success-response.ts`
- **Swagger 配置入口**: `apps/backend/src/swagger-scalar.setup.ts`

## 扩展新模型

只需在 `packages/types` 中新增 Zod Schema 并以 `Schema` 结尾，无需修改后端代码，自动集成到 Swagger 文档。

**最佳实践：**
1. 在 `packages/types/src/common.ts` 或新文件中定义 Zod Schema，命名如 `YourNewModelSchema`
2. 添加必要的 `.meta({ title, description, examples })` 元数据，提升文档可读性
3. 重启开发服务器，新模型会自动出现在 Swagger "Schemas" 区域

## 注意事项

1. 所有 API 响应建议使用统一格式（BaseResponse/SuccessResponse/ErrorResponse）
2. 错误码请使用预定义的 `ErrorCode` 枚举
3. 分页接口建议统一使用 `PaginationQuery` 参数和分页响应模型
4. 建议在 API 描述中引用相关模型名称，方便开发者查找
5. 所有模型和枚举自动注册，无需手动维护列表

## 示例 Controller

参考 `apps/backend/src/modules/address/address-demo.controller.ts`，其中包含完整的自动模型集成和响应装饰器用法。

## 如何使用

### 1. 在 Controller 中使用统一响应装饰器

```typescript
import { ApiSuccessResponse, ApiErrorResponses } from 'src/common/decorator';
import { z } from 'zod/v4';

@Controller('example')
export class ExampleController {
    @ApiOperation({
        summary: '示例接口',
        description: '响应格式遵循 SuccessResponse 模型'
    })
    @ApiSuccessResponse(z.array(YourDataSchema), {
        description: '成功获取数据',
        example: {
            code: 0,
            message: '操作成功',
            data: [/* 你的数据 */],
            timestamp: Date.now()
        }
    })
    @ApiErrorResponses()
    @Get('data')
    getData() {
        return this.service.getData();
    }
}
```

### 2. 分页接口使用方式

```typescript
@ApiSuccessResponse(z.array(YourItemSchema), {
    description: '分页查询成功',
    isPaginated: true,
    example: {
        code: 0,
        message: '操作成功',
        data: {
            items: [/* 数据数组 */],
            meta: {
                page: 1,
                limit: 10,
                total: 100,
                totalPages: 10,
                hasNext: true,
                hasPrev: false
            }
        },
        timestamp: Date.now()
    }
})
@Get('paginated-data')
getPaginatedData(@Query() query: PaginationQuery) {
    return this.service.getPaginatedData(query);
}
```

## 查看模型文档

1. 启动开发服务器: `pnpm dev --filter backend`
2. 访问 Swagger 文档: `http://localhost:5050/api-docs`
3. 在文档底部找到 "Schemas" 部分
4. 点击相应的模型名称查看详细定义

## 模型文件位置

- **公共类型定义**: `packages/types/src/common.ts`
- **Swagger 模型注册**: `apps/backend/src/common/swagger/swagger-models.ts`
- **响应装饰器**: `apps/backend/src/common/decorator/api-success-response.ts`
- **Swagger 配置**: `apps/backend/src/swagger-scalar.setup.ts`

## 扩展新模型

如果需要添加新的公共模型到 Swagger 文档中：

1. 在 `packages/types/src/common.ts` 中定义 Zod Schema
2. 在 `SwaggerModels.getGlobalSchemas()` 中添加对应的转换
3. 重启开发服务器，新模型会自动出现在文档中

## 注意事项

1. 所有的 API 响应都应该遵循统一的响应格式
2. 错误码应该使用预定义的 `ErrorCode` 枚举
3. 分页接口应该使用统一的分页参数和响应格式
4. 建议在 API 描述中引用相关的模型名称，方便开发者查找

## 示例 Controller

参考 `apps/backend/src/modules/address/address-demo.controller.ts` 文件，其中包含了完整的使用示例。
