# Nest.js 通用异常过滤器

这是一个功能完善的Nest.js通用异常过滤器，能够捕获和处理各种类型的错误，包括HTTP错误、数据库错误和自定义业务错误。

## 特性

- 统一的错误响应格式
- 自定义错误代码系统
- 支持多种错误类型的处理
- 集成日志记录
- 开发环境下提供详细的错误信息

## 错误响应格式

所有错误都会被转换为以下统一格式：

```json
{
  "code": 1000, // 错误代码
  "message": "错误消息", // 用户友好的错误描述
  "details": {}, // 错误详情（可选）
  "timestamp": "2023-01-01T00:00:00.000Z", // 错误发生时间
  "path": "/api/example", // 请求路径
  "stack": "Error: ..." // 错误堆栈（仅在非生产环境）
}
```

## 错误代码系统

错误代码按照类别进行分组：

- 1000-1999: 系统级错误
- 2000-2999: HTTP错误
- 3000-3999: 数据库错误
- 4000-4999: 验证错误
- 5000-5999: 业务逻辑错误
- 6000-6999: 外部服务错误

## 使用方法

### 1. 注册全局异常过滤器

在`main.ts`文件中注册全局异常过滤器：

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/exceptions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 注册全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000);
}
bootstrap();
```

### 2. 使用自定义异常

在业务代码中抛出自定义异常：

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
  NotFoundException,
  ValidationException,
} from './common/exceptions';

@Controller('example')
export class ExampleController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    // 业务逻辑错误
    if (id === 'invalid') {
      throw new BusinessException('无效的ID', ErrorCode.BUSINESS_ERROR, {
        id: id,
        reason: '提供的ID格式不正确',
      });
    }

    // 资源不存在错误
    if (id === '999') {
      throw new NotFoundException('用户不存在', ErrorCode.RESOURCE_NOT_FOUND, {
        userId: id,
      });
    }

    // 验证错误
    if (id === '0') {
      throw new ValidationException('ID必须大于0', ErrorCode.INVALID_PARAM, {
        param: 'id',
        value: id,
        constraint: 'min:1',
      });
    }

    return { id, name: 'Example' };
  }
}
```

### 3. 处理数据库错误

使用数据库错误处理工具：

```typescript
import { Injectable } from '@nestjs/common';
import { handleDatabaseError } from './common/exceptions';

@Injectable()
export class UserService {
  async create(userData: any) {
    try {
      // 数据库操作...
      return await this.userRepository.save(userData);
    } catch (error) {
      // 将数据库错误转换为应用异常
      throw handleDatabaseError(error);
    }
  }
}
```

## 自定义异常类型

### AppException

所有自定义异常的基类：

```typescript
throw new AppException(
  '错误消息',
  ErrorCode.INTERNAL_ERROR,
  HttpStatus.INTERNAL_SERVER_ERROR,
  { key: 'value' }, // 可选的详细信息
);
```

### BusinessException

业务逻辑错误：

```typescript
throw new BusinessException(
  '业务逻辑错误',
  ErrorCode.BUSINESS_ERROR, // 可选，默认为BUSINESS_ERROR
  { key: 'value' }, // 可选的详细信息
);
```

### NotFoundException

资源不存在错误：

```typescript
throw new NotFoundException(
  '资源不存在', // 可选，默认为'资源不存在'
  ErrorCode.RESOURCE_NOT_FOUND, // 可选，默认为RESOURCE_NOT_FOUND
  { resourceId: '123' }, // 可选的详细信息
);
```

### ValidationException

验证错误：

```typescript
throw new ValidationException(
  '验证失败', // 可选，默认为'验证失败'
  ErrorCode.VALIDATION_ERROR, // 可选，默认为VALIDATION_ERROR
  {
    errors: [{ field: 'username', message: '用户名不能为空' }],
  }, // 可选的详细信息
);
```

### UnauthorizedException

未授权错误：

```typescript
throw new UnauthorizedException(
  '未授权', // 可选，默认为'未授权'
  ErrorCode.UNAUTHORIZED, // 可选，默认为UNAUTHORIZED
  { reason: '令牌已过期' }, // 可选的详细信息
);
```

### ForbiddenException

禁止访问错误：

```typescript
throw new ForbiddenException(
  '禁止访问', // 可选，默认为'禁止访问'
  ErrorCode.FORBIDDEN, // 可选，默认为FORBIDDEN
  { requiredRole: 'admin' }, // 可选的详细信息
);
```

### DatabaseException

数据库错误：

```typescript
throw new DatabaseException(
  '数据库错误', // 可选，默认为'数据库错误'
  ErrorCode.DATABASE_ERROR, // 可选，默认为DATABASE_ERROR
  { query: 'SELECT * FROM users' }, // 可选的详细信息
);
```

## 客户端处理示例

前端可以根据错误代码进行不同的处理：

```typescript
// 前端请求示例
async function fetchData() {
  try {
    const response = await fetch('/api/example');
    if (!response.ok) {
      const errorData = await response.json();
      handleError(errorData);
    }
    return await response.json();
  } catch (error) {
    console.error('请求失败:', error);
  }
}

// 错误处理函数
function handleError(errorData) {
  const { code, message, details } = errorData;

  // 根据错误代码处理
  switch (code) {
    case 2001: // UNAUTHORIZED
      // 跳转到登录页
      redirectToLogin();
      break;

    case 2002: // FORBIDDEN
      // 显示权限不足提示
      showPermissionDenied(message);
      break;

    case 2003: // NOT_FOUND
      // 显示资源不存在提示
      showNotFound(message);
      break;

    case 4000: // VALIDATION_ERROR
      // 显示表单验证错误
      showValidationErrors(details?.errors);
      break;

    case 5000: // BUSINESS_ERROR
      // 显示业务错误提示
      showBusinessError(message, details);
      break;

    default:
      // 显示通用错误提示
      showGeneralError(message);
      break;
  }
}
```
