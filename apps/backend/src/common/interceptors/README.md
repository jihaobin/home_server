# Nest.js 通用拦截器模块

这是一个功能完善的Nest.js通用拦截器模块，用于统一API响应格式、处理分页数据、缓存响应和处理请求超时等。

## 特性

- 统一的API响应格式
- 标准化的分页数据格式
- 请求超时处理
- 响应缓存支持
- 与日志模块和异常过滤器集成

## 统一响应格式

所有API响应都会被转换为以下统一格式：

```json
{
  "code": 0, // 状态码，0表示成功
  "message": "操作成功", // 消息
  "data": {}, // 数据
  "timestamp": 1625097600000 // 时间戳
}
```

## 分页数据格式

分页数据会被转换为以下格式：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {
    "items": [
      { "id": 1, "name": "示例1" },
      { "id": 2, "name": "示例2" }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1625097600000
}
```

## 使用方法

### 1. 全局注册拦截器

在`app.module.ts`文件中导入并注册拦截器模块：

```typescript
import { Module } from '@nestjs/common';
import { InterceptorsModule } from './common/interceptors';

@Module({
  imports: [
    InterceptorsModule.forRoot({
      enableTransform: true,
      enableTimeout: true,
      timeout: 30000,
      defaultSuccessMessage: '操作成功',
    }),
  ],
})
export class AppModule {}
```

### 2. 使用分页拦截器

在控制器方法上使用分页拦截器：

```typescript
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { PaginationInterceptor } from './common/interceptors';

@Controller('users')
export class UsersController {
  @Get()
  @UseInterceptors(PaginationInterceptor)
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    // 返回符合分页拦截器要求的数据格式
    return {
      items: [
        /* 数据项 */
      ],
      total: 100, // 总条数
      page: Number(page),
      limit: Number(limit),
    };
  }
}
```

### 3. 使用缓存拦截器

在控制器方法上使用缓存拦截器()：

```typescript
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from './common/interceptors';

@Controller('products')
export class ProductsController {
  constructor(
    private cacheManager: Cache,
    private logger: AppLoggerService,
  ) {}

  @Get()
  @UseInterceptors(
    new CacheInterceptor(this.cacheManager, this.logger, { ttl: 60 }),
  )
  findAll() {
    return [
      /* 产品数据 */
    ];
  }
}
```

### 4. 自定义响应消息

控制器方法可以返回带有`message`字段的对象，该字段会被用作响应消息：

```typescript
@Get('custom-message')
findWithCustomMessage() {
  return {
    message: '自定义成功消息',
    data: { /* 数据 */ }
  };
}
```

## 拦截器类型

### TransformInterceptor

统一API响应格式的拦截器。

```typescript
const transformInterceptor = new TransformInterceptor(logger, {
  logResponse: true,
  includeTimestamp: true,
  defaultSuccessMessage: '操作成功',
});
```

### PaginationInterceptor

处理分页数据的拦截器。

```typescript
const paginationInterceptor = new PaginationInterceptor({
  defaultPage: 1,
  defaultLimit: 10,
});
```

### TimeoutInterceptor

处理请求超时的拦截器。

```typescript
const timeoutInterceptor = new TimeoutInterceptor(logger, {
  timeout: 30000,
  errorMessage: '请求超时，请稍后重试',
});
```

### CacheInterceptor

缓存API响应的拦截器。

```typescript
const cacheInterceptor = new CacheInterceptor(cacheManager, logger, {
  ttl: 60,
  logCacheEvents: true,
  keyPrefix: 'api-cache:',
});
```

## 与其他模块的集成

### 与日志模块集成

拦截器模块与日志模块集成，记录请求和响应信息：

```typescript
// 在拦截器中使用日志服务
constructor(private readonly logger: AppLoggerService) {
  this.logger.setContext('TransformInterceptor');
}

// 记录请求日志
this.logger.log(`请求开始 - ${method} ${url}`);

// 记录响应日志
this.logger.log(`请求完成 - ${method} ${url} - ${statusCode} - ${duration}ms`);
```

### 与异常过滤器集成

拦截器模块与异常过滤器集成，处理请求超时等异常：

```typescript
// 在超时拦截器中抛出异常
return throwError(
  () =>
    new RequestTimeoutException({
      message: this.options.errorMessage,
      code: ApiErrorCode.TIMEOUT_ERROR,
      path: url,
      timestamp: Date.now(),
    }),
);
```

## 客户端使用示例

前端可以统一处理API响应：

```typescript
// 请求示例
async function fetchData() {
  try {
    const response = await fetch('/api/example');
    const result = await response.json();

    if (result.code === 0) {
      // 成功处理
      return result.data;
    } else {
      // 错误处理
      handleError(result);
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
}

// 分页数据处理
function renderPaginatedData(result) {
  const { items, meta } = result.data;

  // 渲染数据列表
  renderItems(items);

  // 渲染分页控件
  renderPagination(meta);
}
```

## 拦截器使用指南

### 响应转换拦截器 (TransformInterceptor)

响应转换拦截器用于统一API响应格式，在全局范围内自动应用。

#### 跳过响应转换

在某些情况下，如对接第三方系统时，可能需要返回原始的控制器数据而不是标准的API响应格式。使用 `SkipTransform` 装饰器可以跳过响应转换：

```typescript
import { Controller, Get } from '@nestjs/common';
import { SkipTransform } from '@common/interceptors';

@Controller('external')
export class ExternalController {
  @Get('data')
  @SkipTransform()  // 使用装饰器跳过响应转换
  getExternalData() {
    return { rawData: 'value' };  // 将直接返回这个对象，不会被包装
  }
}
```

使用此装饰器的接口将返回控制器方法的原始返回值，而不会被转换为标准响应格式。
