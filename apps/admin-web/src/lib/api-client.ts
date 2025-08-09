import { createApiClient } from "@repo/utils/api-client"

/**
 * 检测是否在服务端环境
 */
function isServerEnvironment(): boolean {
  return typeof window === 'undefined';
}


/**
 * 获取Next.js服务端headers（仅在服务端环境中可用）
 *
 * 注意：这个函数使用动态导入来避免在编译时依赖 Next.js
 * 这样可以让这个包在没有安装 Next.js 的环境中也能正常编译和使用
 */
async function getServerHeaders(): Promise<Record<string, string> | undefined> {
  if (!isServerEnvironment()) {
    return undefined;
  }

  try {
    // 动态导入Next.js的headers函数
    // 只有在运行时且确实需要时才会尝试加载 Next.js 模块
    // 使用类型断言来告诉 TypeScript 这是一个有效的模块导入
    const nextHeadersModule = await import('next/headers');
    const headersList = await nextHeadersModule.headers();

    // 将Headers对象转换为普通对象
    const headersObj: Record<string, string> = {};
    if (headersList && typeof headersList.forEach === 'function') {
      headersList.forEach((value: string, key: string) => {
        headersObj[key] = value;
      });
    }

    return headersObj;
  } catch (error) {
    // 如果 Next.js 没有安装或者不在 Next.js 环境中，这里会捕获错误
    // 这是正常的，不需要担心
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Next.js headers not available:', errorMessage);
    return undefined;
  }
}


export const apiClient = createApiClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    async onRequest({ options }) {
              // 根据环境自动配置认证
      if (isServerEnvironment()) {
        // 服务端环境：获取headers并传递给请求
        const serverHeaders = await getServerHeaders();
        if (serverHeaders) {
          options.headers = {
            ...options.headers,
            ...serverHeaders,
          };
        }
      } else {
        // 客户端环境：确保credentials设置为include
        options.credentials = 'include';
      }
    }
});
