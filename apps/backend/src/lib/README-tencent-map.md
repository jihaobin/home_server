# 腾讯地图 API 客户端

这是一个为腾讯地图API配置好签名计算的HTTP客户端，基于 `ofetch` 构建。

## 功能特性

- ✅ 自动签名计算：根据腾讯地图API的签名规范自动计算并添加签名
- ✅ 环境变量配置：通过环境变量管理API密钥
- ✅ 错误处理：提供清晰的错误信息
- ✅ TypeScript 支持：完整的类型定义

## 签名计算逻辑

根据[腾讯地图API签名文档](https://lbs.qq.com/faq/serverFaq/webServiceKey)实现：

1. 对请求参数按名称升序排序
2. 拼接请求路径 + "?" + 排序后的参数 + SecretKey
3. 计算MD5值（小写）作为签名

## 环境变量配置

需要在 `.env` 文件中配置以下变量：

```bash
# 腾讯地图密钥
TMAP_KEY=your_tmap_key_here
TMAP_SECRET=your_tmap_secret_key_here
```

## 基本使用

```typescript
import { fetch } from './lib/tencent-map-api-client';

// 逆地址解析
const response = await fetch('/ws/geocoder/v1', {
    query: {
        location: '39.984154,116.307490',
        // key 和 sig 会自动添加
    },
});

// 地点搜索
const searchResult = await fetch('/ws/place/v1/search', {
    query: {
        keyword: '酒店',
        boundary: 'region(北京)',
        // key 和 sig 会自动添加
    },
});
```

## API示例

查看 `tencent-map-examples.ts` 文件获取更多使用示例，包括：

- 逆地址解析
- 地点搜索
- 路线规划

## 签名验证

可以使用腾讯提供的[官方签名验证工具](https://mapapi.qq.com/other/webservice_tools_demos/md5_tool.html)来验证签名计算是否正确。

## 注意事项

1. 确保环境变量 `TMAP_KEY` 和 `TMAP_SECRET` 已正确配置
2. 签名计算使用的是原始未编码的参数值
3. 参数会按照名称进行升序排序
4. 最终的请求URL中会包含自动计算的 `sig` 参数
