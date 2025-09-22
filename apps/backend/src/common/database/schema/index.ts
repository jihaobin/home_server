import { init } from "@paralleldrive/cuid2";

// 导出所有 schema 模块
export * from "./auth-user";
export * from "./user-profiles";
export * from "./shops-service";
export * from "./server";
export * from "./addresses";
export * from "./orders";
export * from "./reviews-social";
export * from "./financial";
export * from "./notifications";
export * from "./coupons";
export * from "./enums";
export * from "./china-city";

export const createId = init({
	length: 15,
});
