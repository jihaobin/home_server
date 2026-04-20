# 全局服务人员收藏写入与列表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于现有 `follows` 模型补齐全局服务人员收藏写入、我的收藏列表页，以及按摩入口/个人中心入口/详情页按钮的完整收藏闭环。

**Architecture:** 后端继续以 `apps/backend/src/modules/follow` 作为唯一收藏模块，扩展写接口与列表接口，不新增新表；共享层在 `@repo/types` 和 `@repo/hooks` 中补齐收藏写入与列表 schema/hooks；移动端新增独立“收藏商户”页面并把按摩 landing、个人中心、服务人员详情页接到同一套全局收藏链路。

**Tech Stack:** NestJS 11、Drizzle ORM、Zod v4、TanStack Query v5、Expo Router 6、React Native、Jest

---

## 文件结构

### 后端

- Modify: `apps/backend/src/modules/follow/follow.controller.ts`
  - 新增 `POST /follows/personnel/:personnelId`
  - 新增 `DELETE /follows/personnel/:personnelId`
  - 新增 `GET /follows/personnel`
- Modify: `apps/backend/src/modules/follow/follow.service.ts`
  - 新增收藏/取消收藏/收藏列表业务逻辑
- Modify: `apps/backend/src/modules/follow/follow.repository.ts`
  - 新增幂等写入、删除、分页列表查询
- Modify: `apps/backend/src/modules/follow/follow.service.spec.ts`
  - 补充 service 单测

### 共享类型

- Modify: `packages/types/src/follow.ts`
  - 新增收藏 mutation response、列表 query/response schema
- Modify: `packages/types/src/index.ts`
  - 确保 `follow` 导出完整可用

### 共享 hooks

- Modify: `packages/hooks/src/api/follow/index.ts`
  - 新增 `useFavoritePersonnel`
  - 新增 `useUnfavoritePersonnel`
  - 新增 `useFavoritePersonnelList`

### 移动端

- Create: `apps/mobile-user/app/profile/favorite-personnel.tsx`
  - 收藏列表页路由
- Modify: `apps/mobile-user/app/(tabs)/profile.tsx`
  - 新增“收藏商户”菜单入口
- Modify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`
  - 为“收藏商户”入口补点击行为
- Modify: `apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx`
  - 将收藏按钮从静态展示改为真实 mutation

## Task 1: 定义全局收藏写入与列表共享类型

**Files:**
- Modify: `packages/types/src/follow.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 先写类型 schema，覆盖 mutation response 与列表 query/response**

```ts
import { z } from "zod/v4";

export const PersonnelFavoriteMutationResponseSchema = z
    .object({
        personnelId: z.string().max(255),
        favoriteCount: z.number().int().min(0),
        isFavorited: z.boolean(),
    })
    .meta({
        title: "服务人员收藏写接口响应",
        description: "收藏或取消收藏后的最新收藏状态",
    });

export const ListFavoritePersonnelQuerySchema = z
    .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
    })
    .meta({
        title: "我的收藏服务人员列表查询",
        description: "分页获取当前用户已收藏的服务人员",
    });

export const FavoritePersonnelListItemSchema = z
    .object({
        personnelId: z.string().max(255),
        personnelName: z.string().max(255),
        avatarUrl: z.string().url().nullable(),
        avatarBlurhash: z.string().nullable(),
        addressText: z.string().max(255),
        distanceText: z.string().nullable(),
        availableTimeText: z.string().nullable(),
        favoriteCount: z.number().int().min(0),
        reviewCount: z.number().int().min(0),
        ratingValue: z.number().min(0),
        yearlyOrderCount: z.number().int().min(0),
        primaryServiceId: z.string().max(255).nullable(),
        primaryPricingId: z.string().max(255).nullable(),
        primaryServiceName: z.string().max(255).nullable(),
        favoritedAt: z.string().datetime().nullable(),
    })
    .meta({
        title: "收藏服务人员卡片",
        description: "收藏列表页中的单个服务人员卡片数据",
    });

export const FavoritePersonnelListResponseSchema = z
    .object({
        items: z.array(FavoritePersonnelListItemSchema),
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        hasMore: z.boolean(),
    })
    .meta({
        title: "我的收藏服务人员列表响应",
        description: "分页返回当前用户已收藏的服务人员列表",
    });

export type PersonnelFavoriteMutationResponse = z.infer<
    typeof PersonnelFavoriteMutationResponseSchema
>;
export type ListFavoritePersonnelQuery = z.infer<
    typeof ListFavoritePersonnelQuerySchema
>;
export type FavoritePersonnelListItem = z.infer<
    typeof FavoritePersonnelListItemSchema
>;
export type FavoritePersonnelListResponse = z.infer<
    typeof FavoritePersonnelListResponseSchema
>;
```

- [ ] **Step 2: 确认 `@repo/types` 聚合导出已覆盖 `follow`**

```ts
export * from "./follow";
```

- [ ] **Step 3: 运行类型检查验证 schema 可构建**

Run: `pnpm --filter @repo/types type-check`

Expected: PASS，`follow.ts` 中新增 schema/type 无 TS 错误。

- [ ] **Step 4: 提交这一小步**

```bash
git add packages/types/src/follow.ts packages/types/src/index.ts
git commit -m "feat(types): add favorite mutation and list schemas"
```

## Task 2: 先写失败测试，再补后端收藏写入与列表服务

**Files:**
- Modify: `apps/backend/src/modules/follow/follow.service.spec.ts`
- Modify: `apps/backend/src/modules/follow/follow.service.ts`
- Modify: `apps/backend/src/modules/follow/follow.repository.ts`
- Modify: `apps/backend/src/modules/follow/follow.controller.ts`

- [ ] **Step 1: 在 `follow.service.spec.ts` 先补失败测试，锁定收藏/取消收藏/列表行为**

```ts
import { FollowService } from "./follow.service";

describe("FollowService", () => {
    it("返回 favoriteCount 和 isFavorited", async () => {
        const repository = {
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(12),
            existsActiveFavorite: jest.fn().mockResolvedValue(true),
        } as any;

        const service = new FollowService(repository);
        const result = await service.getPersonnelFavoriteSummary(
            "personnel_1",
            "user_1",
        );

        expect(result).toEqual({
            personnelId: "personnel_1",
            favoriteCount: 12,
            isFavorited: true,
        });
    });

    it("收藏成功后返回最新状态", async () => {
        const repository = {
            ensureFavoritablePersonnelExists: jest.fn().mockResolvedValue({
                personnelId: "personnel_1",
                userId: "personnel_1",
            }),
            createFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(5),
        } as any;

        const service = new FollowService(repository);
        const result = await service.favoritePersonnel("user_1", "personnel_1");

        expect(repository.createFavorite).toHaveBeenCalledWith(
            "user_1",
            "personnel_1",
        );
        expect(result).toEqual({
            personnelId: "personnel_1",
            favoriteCount: 5,
            isFavorited: true,
        });
    });

    it("取消收藏成功后返回最新状态", async () => {
        const repository = {
            ensureFavoritablePersonnelExists: jest.fn().mockResolvedValue({
                personnelId: "personnel_1",
                userId: "personnel_1",
            }),
            deleteFavorite: jest.fn().mockResolvedValue(undefined),
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(4),
        } as any;

        const service = new FollowService(repository);
        const result = await service.unfavoritePersonnel(
            "user_1",
            "personnel_1",
        );

        expect(repository.deleteFavorite).toHaveBeenCalledWith(
            "user_1",
            "personnel_1",
        );
        expect(result).toEqual({
            personnelId: "personnel_1",
            favoriteCount: 4,
            isFavorited: false,
        });
    });

    it("收藏自己时报错", async () => {
        const repository = {
            ensureFavoritablePersonnelExists: jest.fn().mockResolvedValue({
                personnelId: "personnel_1",
                userId: "user_1",
            }),
        } as any;

        const service = new FollowService(repository);

        await expect(
            service.favoritePersonnel("user_1", "personnel_1"),
        ).rejects.toThrow("不能收藏自己");
    });

    it("返回我的收藏列表", async () => {
        const repository = {
            listFavoritePersonnel: jest.fn().mockResolvedValue({
                items: [
                    {
                        personnelId: "personnel_1",
                        personnelName: "张三",
                        avatarUrl: null,
                        avatarBlurhash: null,
                        addressText: "武昌区徐东",
                        distanceText: null,
                        availableTimeText: null,
                        favoriteCount: 8,
                        reviewCount: 12,
                        ratingValue: 4.8,
                        yearlyOrderCount: 99,
                        primaryServiceId: "service_1",
                        primaryPricingId: "pricing_1",
                        primaryServiceName: "上门按摩",
                        favoritedAt: "2026-04-17T10:00:00.000Z",
                    },
                ],
                total: 1,
            }),
        } as any;

        const service = new FollowService(repository);
        const result = await service.listFavoritePersonnel("user_1", {
            page: 1,
            pageSize: 10,
        });

        expect(result).toEqual({
            items: expect.any(Array),
            page: 1,
            pageSize: 10,
            total: 1,
            hasMore: false,
        });
    });
});
```

- [ ] **Step 2: 运行 follow service 测试，确认新增用例先失败**

Run: `pnpm --filter backend test -- --runInBand apps/backend/src/modules/follow/follow.service.spec.ts`

Expected: FAIL，提示 `favoritePersonnel` / `unfavoritePersonnel` / `listFavoritePersonnel` 或 repository mock 调用不存在。

- [ ] **Step 3: 在 `follow.service.ts` 实现最小业务逻辑**

```ts
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ListFavoritePersonnelQuery } from "@repo/types";
import { FollowRepository } from "./follow.repository";

@Injectable()
export class FollowService {
    constructor(private readonly repository: FollowRepository) {}

    async getPersonnelFavoriteSummary(personnelId: string, userId?: string) {
        const [favoriteCount, isFavorited] = await Promise.all([
            this.repository.countFavoritesByPersonnelId(personnelId),
            userId
                ? this.repository.existsActiveFavorite(userId, personnelId)
                : Promise.resolve(false),
        ]);

        return {
            personnelId,
            favoriteCount,
            isFavorited,
        };
    }

    async favoritePersonnel(userId: string, personnelId: string) {
        const personnel =
            await this.repository.ensureFavoritablePersonnelExists(personnelId);

        if (!personnel) {
            throw new NotFoundException("服务人员不存在");
        }

        if (personnel.userId === userId) {
            throw new BadRequestException("不能收藏自己");
        }

        await this.repository.createFavorite(userId, personnelId);
        const favoriteCount =
            await this.repository.countFavoritesByPersonnelId(personnelId);

        return {
            personnelId,
            favoriteCount,
            isFavorited: true,
        };
    }

    async unfavoritePersonnel(userId: string, personnelId: string) {
        const personnel =
            await this.repository.ensureFavoritablePersonnelExists(personnelId);

        if (!personnel) {
            throw new NotFoundException("服务人员不存在");
        }

        await this.repository.deleteFavorite(userId, personnelId);
        const favoriteCount =
            await this.repository.countFavoritesByPersonnelId(personnelId);

        return {
            personnelId,
            favoriteCount,
            isFavorited: false,
        };
    }

    async listFavoritePersonnel(
        userId: string,
        query: Partial<ListFavoritePersonnelQuery>,
    ) {
        const page = query.page && query.page > 0 ? query.page : 1;
        const pageSize =
            query.pageSize && query.pageSize > 0 ? query.pageSize : 10;

        const { items, total } = await this.repository.listFavoritePersonnel(
            userId,
            page,
            pageSize,
        );

        return {
            items,
            page,
            pageSize,
            total,
            hasMore: page * pageSize < total,
        };
    }
}
```

- [ ] **Step 4: 在 `follow.repository.ts` 实现幂等写入、删除、存在校验与列表查询**

```ts
import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { DB } from "src/common/database/database.provider";
import type { DbType } from "src/common/database/db";
import { follows, servicePersonnel, users } from "src/common/database/schema";

@Injectable()
export class FollowRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async countFavoritesByPersonnelId(personnelId: string): Promise<number> {
        const [row] = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(follows)
            .where(eq(follows.followingId, personnelId));

        return Number(row?.count ?? 0);
    }

    async existsActiveFavorite(userId: string, personnelId: string) {
        const [row] = await this.db
            .select({ followingId: follows.followingId })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, userId),
                    eq(follows.followingId, personnelId),
                ),
            )
            .limit(1);

        return Boolean(row);
    }

    async ensureFavoritablePersonnelExists(personnelId: string) {
        const [row] = await this.db
            .select({
                personnelId: servicePersonnel.userId,
                userId: servicePersonnel.userId,
            })
            .from(servicePersonnel)
            .where(eq(servicePersonnel.userId, personnelId))
            .limit(1);

        return row ?? null;
    }

    async createFavorite(userId: string, personnelId: string) {
        await this.db
            .insert(follows)
            .values({
                followerId: userId,
                followingId: personnelId,
            })
            .onConflictDoNothing();
    }

    async deleteFavorite(userId: string, personnelId: string) {
        await this.db
            .delete(follows)
            .where(
                and(
                    eq(follows.followerId, userId),
                    eq(follows.followingId, personnelId),
                ),
            );
    }

    async listFavoritePersonnel(userId: string, page: number, pageSize: number) {
        const offset = (page - 1) * pageSize;

        const items = await this.db
            .select({
                personnelId: follows.followingId,
                personnelName: users.name,
                favoritedAt: sql<string | null>`NOW()`,
            })
            .from(follows)
            .innerJoin(users, eq(users.id, follows.followingId))
            .innerJoin(
                servicePersonnel,
                eq(servicePersonnel.userId, follows.followingId),
            )
            .where(eq(follows.followerId, userId))
            .orderBy(desc(follows.followingId))
            .limit(pageSize)
            .offset(offset);

        const [totalRow] = await this.db
            .select({ count: count() })
            .from(follows)
            .where(eq(follows.followerId, userId));

        return {
            items: items.map((item) => ({
                personnelId: item.personnelId,
                personnelName: item.personnelName ?? "未命名服务人员",
                avatarUrl: null,
                avatarBlurhash: null,
                addressText: "",
                distanceText: null,
                availableTimeText: null,
                favoriteCount: 0,
                reviewCount: 0,
                ratingValue: 0,
                yearlyOrderCount: 0,
                primaryServiceId: null,
                primaryPricingId: null,
                primaryServiceName: null,
                favoritedAt: item.favoritedAt,
            })),
            total: Number(totalRow?.count ?? 0),
        };
    }
}
```

- [ ] **Step 5: 在 `follow.controller.ts` 暴露新增接口**

```ts
import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import {
    FavoritePersonnelListResponseSchema,
    PersonnelFavoriteMutationResponseSchema,
    PersonnelFavoriteSummaryResponseSchema,
} from "@repo/types";

@ApiTags("收藏")
@Controller("follows")
export class FollowController {
    constructor(private readonly followService: FollowService) {}

    @UseGuards(AuthGuard)
    @Get("personnel/:personnelId/summary")
    @AuthOptional()
    @ApiSuccessResponse(PersonnelFavoriteSummaryResponseSchema)
    async getPersonnelFavoriteSummary(
        @Param("personnelId") personnelId: string,
        @Req() req: Request,
    ) {
        return await this.followService.getPersonnelFavoriteSummary(
            personnelId,
            req.user?.id,
        );
    }

    @UseGuards(AuthGuard)
    @Post("personnel/:personnelId")
    @ApiSuccessResponse(PersonnelFavoriteMutationResponseSchema)
    async favoritePersonnel(
        @Param("personnelId") personnelId: string,
        @Req() req: Request,
    ) {
        return await this.followService.favoritePersonnel(
            req.user!.id,
            personnelId,
        );
    }

    @UseGuards(AuthGuard)
    @Delete("personnel/:personnelId")
    @ApiSuccessResponse(PersonnelFavoriteMutationResponseSchema)
    async unfavoritePersonnel(
        @Param("personnelId") personnelId: string,
        @Req() req: Request,
    ) {
        return await this.followService.unfavoritePersonnel(
            req.user!.id,
            personnelId,
        );
    }

    @UseGuards(AuthGuard)
    @Get("personnel")
    @ApiSuccessResponse(FavoritePersonnelListResponseSchema)
    async listFavoritePersonnel(
        @Req() req: Request,
        @Query("page") page?: string,
        @Query("pageSize") pageSize?: string,
    ) {
        return await this.followService.listFavoritePersonnel(req.user!.id, {
            page: page ? Number(page) : 1,
            pageSize: pageSize ? Number(pageSize) : 10,
        });
    }
}
```

- [ ] **Step 6: 运行 follow service 测试，确认业务层转绿**

Run: `pnpm --filter backend test -- --runInBand apps/backend/src/modules/follow/follow.service.spec.ts`

Expected: PASS，`FollowService` 新增用例全部通过。

- [ ] **Step 7: 运行后端类型检查，确认 controller/repository 签名一致**

Run: `pnpm --filter backend type-check`

Expected: PASS，`follow` 模块新增接口与 schema 引用无 TS 错误。

- [ ] **Step 8: 提交后端这一段**

```bash
git add apps/backend/src/modules/follow/follow.controller.ts apps/backend/src/modules/follow/follow.service.ts apps/backend/src/modules/follow/follow.repository.ts apps/backend/src/modules/follow/follow.service.spec.ts
git commit -m "feat(backend): add favorite write and list endpoints"
```

## Task 3: 增加共享收藏 hooks，并接入缓存失效策略

**Files:**
- Modify: `packages/hooks/src/api/follow/index.ts`

- [ ] **Step 1: 在 `packages/hooks/src/api/follow/index.ts` 先补 hooks 实现**

```ts
import type {
    FavoritePersonnelListResponse,
    PersonnelFavoriteMutationResponse,
    PersonnelFavoriteSummaryResponse,
} from "@repo/types";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

export const usePersonnelFavoriteSummary = (personnelId: string) =>
    useSuspenseQuery({
        queryKey: ["personnel-favorite-summary", personnelId],
        queryFn: async () => {
            const response = await apiClient.get<PersonnelFavoriteSummaryResponse>(
                `/follows/personnel/${personnelId}/summary`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "收藏状态获取失败",
        },
    });

export const useFavoritePersonnel = (personnelId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response =
                await apiClient.post<PersonnelFavoriteMutationResponse>(
                    `/follows/personnel/${personnelId}`,
                );
            return response.data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["personnel-favorite-summary", personnelId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["favorite-personnel-list"],
            });
        },
        meta: {
            errorMessage: "收藏失败",
        },
    });
};

export const useUnfavoritePersonnel = (personnelId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response =
                await apiClient.delete<PersonnelFavoriteMutationResponse>(
                    `/follows/personnel/${personnelId}`,
                );
            return response.data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["personnel-favorite-summary", personnelId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["favorite-personnel-list"],
            });
        },
        meta: {
            errorMessage: "取消收藏失败",
        },
    });
};

export const useFavoritePersonnelList = (page = 1, pageSize = 10) =>
    useSuspenseQuery({
        queryKey: ["favorite-personnel-list", page, pageSize],
        queryFn: async () => {
            const response = await apiClient.get<FavoritePersonnelListResponse>(
                "/follows/personnel",
                {
                    query: {
                        page: String(page),
                        pageSize: String(pageSize),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "收藏列表获取失败",
        },
    });
```

- [ ] **Step 2: 运行 hooks 包类型检查**

Run: `pnpm --filter @repo/hooks type-check`

Expected: PASS，新增 hooks 与 `apiClient.delete` / `apiClient.post` 泛型签名兼容。

- [ ] **Step 3: 提交共享 hooks**

```bash
git add packages/hooks/src/api/follow/index.ts
git commit -m "feat(hooks): add favorite write and list hooks"
```

## Task 4: 新增移动端“收藏商户”页面并接通按摩/个人中心入口

**Files:**
- Create: `apps/mobile-user/app/profile/favorite-personnel.tsx`
- Modify: `apps/mobile-user/app/(tabs)/profile.tsx`
- Modify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`

- [ ] **Step 1: 创建收藏列表页路由文件**

```tsx
import { useMemo, Suspense } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { useFavoritePersonnelList } from "@repo/hooks/api/follow";

function FavoritePersonnelListContent() {
    const router = useRouter();
    const data = useFavoritePersonnelList(1, 10).data;

    if (!data.items.length) {
        return (
            <View className="flex-1 items-center justify-center px-6">
                <Text className="text-base font-puhui-medium text-foreground">
                    暂无收藏商户
                </Text>
                <Text className="mt-2 text-sm font-puhui-regular text-muted-foreground">
                    去逛逛并收藏感兴趣的服务人员
                </Text>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-background">
            <View className="px-4 py-4" style={{ gap: 12 }}>
                {data.items.map((item) => (
                    <Pressable
                        key={item.personnelId}
                        className="rounded-xl bg-card px-4 py-4"
                        onPress={() => {
                            router.push({
                                pathname: "/servicePersonnel/[id]",
                                params: {
                                    id: item.personnelId,
                                    ...(item.primaryServiceId
                                        ? { serviceId: item.primaryServiceId }
                                        : {}),
                                    ...(item.primaryPricingId
                                        ? { pricingId: item.primaryPricingId }
                                        : {}),
                                    ...(item.primaryServiceName
                                        ? { serviceName: item.primaryServiceName }
                                        : {}),
                                },
                            });
                        }}
                    >
                        <Text className="text-base font-puhui-medium text-foreground">
                            {item.personnelName}
                        </Text>
                        <Text className="mt-2 text-sm font-puhui-regular text-muted-foreground">
                            {item.primaryServiceName ?? "服务人员"}
                        </Text>
                        <Text className="mt-2 text-xs font-puhui-regular text-muted-foreground">
                            收藏 {item.favoriteCount} · 评分 {item.ratingValue}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}

function FavoritePersonnelSkeleton() {
    return (
        <View className="flex-1 bg-background px-4 py-4" style={{ gap: 12 }}>
            {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-24 w-full rounded-xl" />
            ))}
        </View>
    );
}

export default function FavoritePersonnelPage() {
    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="h-12 items-center justify-center border-b border-border">
                <Text className="text-base font-puhui-medium text-foreground">
                    收藏商户
                </Text>
            </View>
            <Suspense fallback={<FavoritePersonnelSkeleton />}>
                <FavoritePersonnelListContent />
            </Suspense>
        </SafeAreaView>
    );
}
```

- [ ] **Step 2: 在个人中心菜单中新增“收藏商户”入口**

```ts
type MenuItem = {
    id:
        | "complaint"
        | "address"
        | "favorite-personnel"
        | "customer-service"
        | "terms"
        | "privacy"
        | "check-update";
    label: string;
    icon: keyof typeof lucideIconRegistry;
    badge?: string;
};

const menuItems = useMemo<readonly MenuItem[]>(
    () => [
        {
            id: "complaint",
            label: "投诉/售后",
            icon: "MessageCircle",
        },
        { id: "address", label: "服务地址", icon: "MapPin" },
        { id: "favorite-personnel", label: "收藏商户", icon: "Heart" },
        { id: "customer-service", label: "官方客服", icon: "Headphones" },
        { id: "terms", label: "用户协议", icon: "FileText" },
        { id: "privacy", label: "隐私政策", icon: "Shield" },
    ],
    [],
);

if (item.id === "favorite-personnel") {
    router.push("/profile/favorite-personnel");
    return;
}
```

- [ ] **Step 3: 给按摩 landing 页“收藏商户”入口补点击行为**

```tsx
function EntryItem({
    item,
    onPress,
}: {
    item: MassageEntry;
    onPress?: () => void;
}) {
    return (
        <Pressable
            className="flex-1 items-center justify-center"
            onPress={onPress}
        >
            <View className="flex-row items-center">
                <SvgXml xml={item.iconXml} width={32} height={32} />
                <Text
                    className="ml-2 text-base font-puhui-medium"
                    style={{ color: item.textColor }}
                >
                    {item.label}
                </Text>
            </View>
        </Pressable>
    );
}

<EntryItem
    item={LANDING_STATIC.entryBar.entries[1]}
    onPress={() => {
        router.push("/profile/favorite-personnel");
    }}
/>
```

- [ ] **Step 4: 运行移动端类型检查，确认新增路由与菜单 ID 无错误**

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，新增页面、菜单入口与按摩 landing 点击行为均通过。

- [ ] **Step 5: 提交移动端列表页与入口接线**

```bash
git add apps/mobile-user/app/profile/favorite-personnel.tsx 'apps/mobile-user/app/(tabs)/profile.tsx' apps/mobile-user/components/massage/massage-landing-screen.tsx
git commit -m "feat(mobile-user): add favorite personnel page and entries"
```

## Task 5: 将服务人员详情页收藏按钮接成真实写操作

**Files:**
- Modify: `apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx`

- [ ] **Step 1: 为详情页引入收藏写 hooks，并计算当前点击动作**

```tsx
import {
    useFavoritePersonnel,
    usePersonnelFavoriteSummary,
    useUnfavoritePersonnel,
} from "@repo/hooks/api/follow";
import { toast } from "sonner-native";

const favoriteSummary = usePersonnelFavoriteSummary(personnelId).data;
const favoritePersonnel = useFavoritePersonnel(personnelId);
const unfavoritePersonnel = useUnfavoritePersonnel(personnelId);
const isFavoriteMutating =
    favoritePersonnel.isPending || unfavoritePersonnel.isPending;

async function handleToggleFavorite(): Promise<void> {
    if (isFavoriteMutating) {
        return;
    }

    if (favoriteSummary.isFavorited) {
        await unfavoritePersonnel.mutateAsync();
        toast.success("已取消收藏");
        return;
    }

    await favoritePersonnel.mutateAsync();
    toast.success("收藏成功");
}
```

- [ ] **Step 2: 将原本静态按钮替换为可点击按钮并处理 pending 态**

```tsx
<Pressable
    className="h-9 min-w-20 items-center justify-center rounded-full bg-[#f7951b] px-4"
    onPress={() => {
        void handleToggleFavorite();
    }}
    disabled={isFavoriteMutating}
    style={isFavoriteMutating ? { opacity: 0.6 } : undefined}
>
    <Text className="text-sm font-puhui-medium text-white">
        {favoriteSummary.isFavorited ? "已收藏" : "收藏"}
    </Text>
</Pressable>
```

- [ ] **Step 3: 运行移动端类型检查，确认详情页收藏链路闭环**

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，`massage-service-personnel-screen.tsx` 中新增 mutation 调用无类型错误。

- [ ] **Step 4: 执行最小验证，确认收藏入口与详情页按钮逻辑可用**

Run: `pnpm --filter mobile-user lint`

Expected: PASS，新增页面和按钮交互未引入 lint 问题。

- [ ] **Step 5: 提交详情页收藏按钮接线**

```bash
git add apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx
git commit -m "feat(mobile-user): wire favorite toggle on personnel detail"
```

## Task 6: 端到端验证与文档同步检查

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-global-favorite-personnel-write-and-list-design.md`（仅当实现与 spec 细节出现必要差异时）

- [ ] **Step 1: 运行后端测试与类型检查**

Run: `pnpm --filter backend test -- --runInBand apps/backend/src/modules/follow/follow.service.spec.ts`

Expected: PASS，收藏 service 单测全部通过。

Run: `pnpm --filter backend type-check`

Expected: PASS。

- [ ] **Step 2: 运行共享包检查**

Run: `pnpm --filter @repo/types type-check`

Expected: PASS。

Run: `pnpm --filter @repo/hooks type-check`

Expected: PASS。

- [ ] **Step 3: 运行移动端检查**

Run: `pnpm --filter mobile-user type-check`

Expected: PASS。

Run: `pnpm --filter mobile-user lint`

Expected: PASS。

- [ ] **Step 4: 手动走查核心路径**

```text
1. 打开按摩页，点击“收藏商户”，确认进入 /profile/favorite-personnel
2. 从任意服务人员详情页点击“收藏”，确认按钮切换为“已收藏”
3. 返回收藏页，确认新收藏对象出现在列表中
4. 再次进入详情页点击“已收藏”，确认变回“收藏”
5. 回到收藏页，确认列表同步移除或刷新
6. 从非按摩入口进入服务人员详情页，确认同样可以收藏/取消收藏
```

- [ ] **Step 5: 若实现与 spec 字段/排序有偏差，则同步修正文档并提交收尾**

```bash
git add docs/superpowers/specs/2026-04-17-global-favorite-personnel-write-and-list-design.md
git commit -m "docs: align favorite implementation spec"
```

## 自检

- Spec coverage：
  - 收藏写接口：Task 2
  - 收藏列表接口：Task 2
  - 共享类型与 hooks：Task 1、Task 3
  - 收藏商户页面：Task 4
  - 按摩入口与个人中心入口：Task 4
  - 详情页真实收藏按钮：Task 5
  - 验证要求：Task 6
- Placeholder scan：
  - 无 `TBD` / `TODO` / “类似 Task N”
- Type consistency：
  - 统一使用 `favoritePersonnel` / `unfavoritePersonnel` / `useFavoritePersonnelList`

