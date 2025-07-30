// 确保 Zod OpenAPI 扩展在导入时执行
import { z } from 'zod/v4';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// 立即扩展 Zod
extendZodWithOpenApi(z);

// 导出所有内容
export * from './common';
export * from './user';
