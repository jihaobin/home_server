import z from "zod/v4";
import {
    ServiceCategories,
    ServiceCategoriesSchema,
    ServicesSchema,
} from "./database-entity";
import { PaginationQuerySchema, PaginationMetaSchema } from "./common";

export const ServiceCategoryRequestSchema = z.object({
    dep: z
        .string()
        .refine((data) => data === undefined || +data <= 3, {
            message: "层级不能超过三级",
        })
        .optional()
        .describe("分类层级"),
    keyword: z.string().optional().describe("搜索关键字"),
});

export type ServiceCategoryRequest = z.infer<
    typeof ServiceCategoryRequestSchema
>;

// 创建服务分类的Schema
export const CreateServiceCategorySchema = ServiceCategoriesSchema.omit({
    id: true,
}).meta({
    title: "创建服务分类",
    description: "创建服务分类的请求参数",
});

export type CreateServiceCategory = z.infer<typeof CreateServiceCategorySchema>;

// 更新服务分类的Schema
export const UpdateServiceCategorySchema = ServiceCategoriesSchema.partial()
    .required({ id: true })
    .meta({
        title: "更新服务分类",
        description: "更新服务分类的请求参数",
    });

export type UpdateServiceCategory = z.infer<typeof UpdateServiceCategorySchema>;

// 删除服务分类的Schema
export const DeleteServiceCategorySchema = z
    .object({
        id: z.string().max(255).min(1, "ID不能为空").meta({
            description: "服务分类ID",
            title: "服务分类ID",
        }),
    })
    .meta({
        title: "删除服务分类",
        description: "删除服务分类的请求参数",
    });

export type DeleteServiceCategory = z.infer<typeof DeleteServiceCategorySchema>;

/**
 * 创建一个可控制最大层级的 ServiceCategoriesSchema
 * @param maxDepth 最大层级（例如 3）
 * @param current 当前层级（内部递归使用）
 */
function createServiceCategoriesSchema(
    maxDepth: number,
    current = 1,
): z.ZodType<any> {
    // 基础结构（复用外部定义）
    const baseShape = {
        ...ServiceCategoriesSchema.shape,
        // 可选：某些接口（如 /home/base）会在分类节点上挂载“该分类下的服务列表”。
        services: z
            .array(ServicesSchema)
            .optional()
            .describe("分类下的服务列表"),
    };

    // 如果还未达到最大层级，则允许继续嵌套 children
    if (current < maxDepth) {
        return z.object({
            ...baseShape,
            children: z
                .array(createServiceCategoriesSchema(maxDepth, current + 1))
                .describe("子分类列表"),
        });
    }

    // 达到最大层级后，不再允许 children 字段
    return z.object(baseShape);
}

// ✅ 生成可递归的 schema（最多 3 层）
const globalServiceCategoriesSchema = (() => {
    // 缓存到 globalThis，避免 HMR/多次导入时重复注册 ID
    const globalObj = globalThis as {
        __serviceCategoriesSchema?: z.ZodTypeAny;
    };
    if (globalObj.__serviceCategoriesSchema) {
        return globalObj.__serviceCategoriesSchema;
    }

    const schema = createServiceCategoriesSchema(3);
    globalObj.__serviceCategoriesSchema = schema;
    return schema;
})();

export const serviceCategoriesSchema = globalServiceCategoriesSchema;

// ✅ 注册 ID 以支持 JSON Schema 引用（推荐）
if (!z.globalRegistry.has(serviceCategoriesSchema)) {
    z.globalRegistry.add(serviceCategoriesSchema, { id: "ServiceCategory" });
}

export type ServiceCategoryTree = ServiceCategories & {
    children: ServiceCategoryTree[];
    iconFileUrl?: string | null;
    services?: z.infer<typeof ServicesSchema>[];
};

export type ServiceCategory = Omit<ServiceCategoryTree, "children">;

// ========== 服务项目相关Schema ==========

// 服务项目列表查询请求Schema（继承通用分页参数）
export const ServiceListRequestSchema = z
    .object({
        ...PaginationQuerySchema.shape,
        categoryId: z.string().max(255).optional().meta({
            description: "服务分类ID",
            title: "服务分类ID",
        }),
        keyword: z.string().optional().meta({
            description: "搜索关键字",
            title: "搜索关键字",
        }),
        minPrice: z.number().min(0).optional().meta({
            description: "最低价格",
            title: "最低价格",
        }),
        maxPrice: z.number().min(0).optional().meta({
            description: "最高价格",
            title: "最高价格",
        }),
        isActive: z.boolean().optional().meta({
            description: "是否激活",
            title: "是否激活",
        }),
    })
    .meta({
        title: "服务项目列表查询请求",
        description: "获取服务项目列表的查询参数",
    });

export type ServiceListRequest = z.infer<typeof ServiceListRequestSchema>;

// 创建服务项目Schema
export const CreateServiceSchema = ServicesSchema.omit({
    id: true,
    imageFileUrl: true,
}).meta({
    title: "创建服务项目",
    description: "创建服务项目的请求参数",
});

export type CreateService = z.infer<typeof CreateServiceSchema>;

// 更新服务项目Schema
export const UpdateServiceSchema = ServicesSchema.partial()
    .omit({ imageFileUrl: true })
    .required({ id: true })
    .meta({
        title: "更新服务项目",
        description: "更新服务项目的请求参数",
    });

export type UpdateService = z.infer<typeof UpdateServiceSchema>;

// 删除服务项目Schema
export const DeleteServiceSchema = z
    .object({
        id: z.string().max(255).min(1, "ID不能为空").meta({
            description: "服务项目ID",
            title: "服务项目ID",
        }),
    })
    .meta({
        title: "删除服务项目",
        description: "删除服务项目的请求参数",
    });

export type DeleteService = z.infer<typeof DeleteServiceSchema>;

// 服务项目详情Schema（包含分类信息）
export const ServiceDetailSchema = z
    .object({
        ...ServicesSchema.shape,
        category: ServiceCategoriesSchema.nullable().meta({
            description: "服务分类信息",
            title: "服务分类信息",
        }),
    })
    .meta({
        title: "服务项目详情",
        description: "包含分类信息的服务项目详情",
    });

export type ServiceDetail = z.infer<typeof ServiceDetailSchema>;

// 分类带服务项目Schema（每个分类下包含其服务列表）
export const CategoryWithServicesSchema = z
    .object({
        ...ServiceCategoriesSchema.shape,
        children: z.array(ServicesSchema).meta({
            description: "该分类下的服务项目列表",
            title: "服务项目列表",
        }),
    })
    .meta({
        title: "分类及其服务项目",
        description: "包含服务项目列表的分类信息",
    });

export type CategoryWithServices = z.infer<typeof CategoryWithServicesSchema>;

// 服务项目列表响应Schema（使用通用分页数据结构）
export const ServiceListResponseSchema = z
    .object({
        items: z.array(CategoryWithServicesSchema).meta({
            description: "分类数据列表",
            title: "分类数据列表",
        }),
        meta: PaginationMetaSchema.meta({
            description: "分页元数据",
            title: "分页元数据",
        }),
    })
    .meta({
        title: "服务项目列表响应",
        description: "以分类为单位的服务项目列表响应数据",
    });

export type ServiceListResponse = z.infer<typeof ServiceListResponseSchema>;

// 服务项目统计Schema
export const ServiceStatsSchema = z
    .object({
        totalServices: z.number().int().min(0).meta({
            description: "总服务数量",
            title: "总服务数量",
        }),
        activeServices: z.number().int().min(0).meta({
            description: "激活服务数量",
            title: "激活服务数量",
        }),
        categoriesCount: z.number().int().min(0).meta({
            description: "分类数量",
            title: "分类数量",
        }),
        // averagePrice: z.number().min(0).meta({
        //     description: '平均价格',
        //     title: '平均价格'
        // })
    })
    .meta({
        title: "服务项目统计",
        description: "服务项目相关统计数据",
    });

export type ServiceStats = z.infer<typeof ServiceStatsSchema>;
