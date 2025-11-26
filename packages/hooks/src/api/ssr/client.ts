import type { ApiClient } from "@repo/utils/api-client";

let ssrApiClient: ApiClient | undefined;

export function setSsrApiClient(client: ApiClient) {
  ssrApiClient = client;
}

export function getSsrApiClient(): ApiClient {
  if (!ssrApiClient) {
    throw new Error(
      "[@repo/hooks/api/ssr] 未初始化 API 客户端，请在应用入口调用 setSsrApiClient()",
    );
  }

  return ssrApiClient;
}
