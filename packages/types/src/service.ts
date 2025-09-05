import z from "zod/v4";
import { ServiceCategoriesSchema } from "./database-entity";

export const ServiceCategoryRequestSchema = z.object({
    dep: z
        .string()
        .refine((data) => data === undefined || +data <= 3, {
            message: "层级不能超过三级",
        })
        .optional()
        .describe("分类层级"),
});

export type ServiceCategoryRequest = z.infer<
    typeof ServiceCategoryRequestSchema
>;

// 创建服务分类的Schema
export const CreateServiceCategorySchema = ServiceCategoriesSchema.omit({id: true}).meta({
    title: '创建服务分类',
    description: '创建服务分类的请求参数'
});

export type CreateServiceCategory = z.infer<typeof CreateServiceCategorySchema>;

// 更新服务分类的Schema
export const UpdateServiceCategorySchema = ServiceCategoriesSchema.partial().required({id: true}).meta({
    title: '更新服务分类',
    description: '更新服务分类的请求参数'
});

export type UpdateServiceCategory = z.infer<typeof UpdateServiceCategorySchema>;

// 删除服务分类的Schema
export const DeleteServiceCategorySchema = z.object({
    id: z.string().max(255).min(1, 'ID不能为空').meta({
        description: '服务分类ID',
        title: '服务分类ID'
    }),
}).meta({
    title: '删除服务分类',
    description: '删除服务分类的请求参数'
});

export type DeleteServiceCategory = z.infer<typeof DeleteServiceCategorySchema>;

export const serviceCategoriesSchema = ServiceCategoriesSchema.extend({
    get children(): z.ZodArray<typeof  serviceCategoriesSchema> {
        return z.array(serviceCategoriesSchema);
    },
}).meta({id: "serviceCategoriesSchema"});

export type ServiceCategory = z.infer<typeof serviceCategoriesSchema>;
