import { z } from "zod/v4";
import {
    AppReleaseAppEnum,
    AppReleaseChannelEnum,
    AppReleasePlatformEnum,
    AppReleaseStatusEnum,
    AppReleasesSchema,
} from "./database-entity";

const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

const numberLike = z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" && v !== "" ? Number(v) : v));

export const AdminCreateAppReleaseSchema = z
    .object({
        app: AppReleaseAppEnum,
        platform: AppReleasePlatformEnum,
        version: z.string().regex(semverRegex, "版本号需符合 semver 规范"),
        buildNumber: numberLike
            .refine(
                (v) => v === undefined || v === null || Number.isInteger(v as number),
                "buildNumber 必须是整数",
            )
            .transform((v) =>
                v === undefined || v === null ? v : (v as number),
            )
            .nullable()
            .optional(),
        forceUpdate: z.boolean().optional(),
        minSupportedVersion: z
            .string()
            .regex(semverRegex, "最小兼容版本需符合 semver 规范")
            .nullable()
            .optional(),
        changelog: z.string().nullable().optional(),
        status: AppReleaseStatusEnum.default("published"),
        isActive: z.boolean().optional(),
        fileId: z.string().max(255).optional(),
        downloadUrlOverride: z.url().nullable().optional(),
        releaseChannel: AppReleaseChannelEnum.default("production"),
        rolloutPercent: numberLike
            .refine(
                (v) =>
                    v === undefined ||
                    v === null ||
                    (Number.isInteger(v as number) &&
                        (v as number) >= 0 &&
                        (v as number) <= 100),
                "rolloutPercent 需在 0-100 之间",
            )
            .transform((v) =>
                v === undefined || v === null ? v : (v as number),
            )
            .default(100)
            .optional(),
        rollbackFromId: z.string().max(255).nullable().optional(),
    })
    .describe("管理员创建应用版本的字段（multipart 其他字段通过 form-data 提交）");

export type AdminCreateAppRelease = z.infer<typeof AdminCreateAppReleaseSchema>;

export const AdminUpdateAppReleaseSchema = AdminCreateAppReleaseSchema.partial()
    .omit({ app: true, platform: true, version: true })
    .extend({
        status: AppReleaseStatusEnum.optional(),
        buildNumber: z.number().int().nonnegative().nullable().optional(),
    })
    .describe("管理员更新应用版本字段");

export type AdminUpdateAppRelease = z.infer<typeof AdminUpdateAppReleaseSchema>;

export const AdminAppReleaseListQuerySchema = z.object({
    app: AppReleaseAppEnum.optional(),
    platform: AppReleasePlatformEnum.optional(),
    status: AppReleaseStatusEnum.optional(),
    isActive: z
        .union([z.literal("true"), z.literal("false")])
        .transform((v) => v === "true")
        .optional(),
});
export type AdminAppReleaseListQuery = z.infer<
    typeof AdminAppReleaseListQuerySchema
>;

export const AppReleaseFileSchema = z.object({
    id: z.string(),
    bucketName: z.string(),
    objectPath: z.string(),
    fileSize: z.number(),
    fileHash: z.string(),
    mimeType: z.string(),
});

export const AppReleaseDetailSchema = AppReleasesSchema.extend({
    file: AppReleaseFileSchema.nullable().optional(),
    downloadUrl: z.string().url().nullable().optional(),
}).describe("应用版本详情（含文件信息和下载链接）");

export type AppReleaseDetail = z.infer<typeof AppReleaseDetailSchema>;

export const AppReleaseListItemSchema = AppReleaseDetailSchema;
export type AppReleaseListItem = z.infer<typeof AppReleaseListItemSchema>;

export const AppUpdateCheckQuerySchema = z.object({
    app: AppReleaseAppEnum,
    platform: AppReleasePlatformEnum,
    currentVersion: z
        .string()
        .regex(semverRegex, "当前版本需符合 semver 规范"),
});
export type AppUpdateCheckQuery = z.infer<typeof AppUpdateCheckQuerySchema>;

export const AppUpdateCheckResponseSchema = z.object({
    latestVersion: z.string().nullable(),
    forceUpdate: z.boolean().default(false),
    minSupportedVersion: z.string().nullable().optional(),
    requireUpdate: z.boolean().default(false),
    optionalUpdate: z.boolean().default(false),
    downloadUrl: z.string().nullable(),
    changelog: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
    hash: z.string().nullable().optional(),
    rollbackHint: z.boolean().optional(),
});
export type AppUpdateCheckResponse = z.infer<
    typeof AppUpdateCheckResponseSchema
>;

export const AppLatestApkDownloadParamsSchema = z.object({
    app: AppReleaseAppEnum,
});
export type AppLatestApkDownloadParams = z.infer<
    typeof AppLatestApkDownloadParamsSchema
>;
