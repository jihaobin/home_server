import { z } from "zod/v4";

export const PersonnelFavoriteSummaryResponseSchema = z
    .object({
        personnelId: z.string().max(255),
        favoriteCount: z.number().int().min(0),
        isFavorited: z.boolean(),
    })
    .meta({
        title: "服务人员收藏读态",
        description: "全局服务人员收藏汇总读接口响应",
    });

export type PersonnelFavoriteSummaryResponse = z.infer<
    typeof PersonnelFavoriteSummaryResponseSchema
>;
