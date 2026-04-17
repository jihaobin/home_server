import { z } from "zod/v4";

export const ServiceTagDomainEnum = z.enum(["massage"]).meta({
    title: "服务标签业务域",
    description: "当前仅开放按摩频道使用的标签域",
});

export type ServiceTagDomain = z.infer<typeof ServiceTagDomainEnum>;

export const ServiceTagSchema = z
    .object({
        id: z.string().max(255),
        name: z.string().max(100),
        slug: z.string().max(100),
        domain: ServiceTagDomainEnum,
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
        description: z.string().nullable().default(null),
    })
    .meta({
        title: "服务标签",
        description: "全局服务标签实体",
    });

export type ServiceTag = z.infer<typeof ServiceTagSchema>;

export const ServiceTagEntrySchema = z
    .object({
        tagId: z.string().max(255),
        tagName: z.string().max(100),
        tagSlug: z.string().max(100),
        domain: ServiceTagDomainEnum,
        serviceCount: z.number().int().min(0),
    })
    .meta({
        title: "服务标签入口",
        description: "客户端 landing 页使用的标签入口",
    });

export type ServiceTagEntry = z.infer<typeof ServiceTagEntrySchema>;
