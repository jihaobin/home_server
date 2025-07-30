/**
 * 缓存模块导出
 * 统一导出缓存模块的公共API
 */

// 导出主模块
export * from './cache.module';

// 导出缓存服务接口
export * from './interfaces/cache-service.interface';

// 导出缓存服务提供者和类型
export * from './providers/cache.provider';

// 导出装饰器
export * from './decorators/cacheable.decorator';
