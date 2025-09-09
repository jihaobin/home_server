import { z } from 'zod/v4';
import { ServicePersonnelSchema, ServicesSchema, ServicePersonnelPricingSchema } from './database-entity';

// ==================== Work Skill 相关 Zod Schema ====================

// 更新工作人员信息请求 Schema（不包含 userId，由认证中间件提供）
export const UpsertWorkInfoRequestSchema = ServicePersonnelSchema.omit({
    userId: true,
});

// 更新工作人员技能请求 Schema
export const UpdatePersonnelSkillsRequestSchema = z.object({
    serviceIds: z.array(z.string().min(1, '服务ID不能为空')).meta({
        description: '服务ID数组，传入空数组将清除该工作人员的所有技能',
        title: '服务ID数组'
    }),
}).meta({
    title: '更新工作人员技能请求',
    description: '更新工作人员技能的请求参数'
});

// 获取工作人员信息请求 Schema
export const GetPersonnelInfoRequestSchema = z.object({
    personnelId: z.string().min(1, '工作人员ID不能为空').meta({
        description: '工作人员用户ID',
        title: '工作人员ID'
    }),
}).meta({
    title: '获取工作人员信息请求',
    description: '获取工作人员信息的请求参数'
});

// 技能更新结果 Schema
export const SkillUpdateResultSchema = z.object({
    added: z.number().int().min(0).meta({
        description: '新增的技能数量',
        title: '新增数量'
    }),
    removed: z.number().int().min(0).meta({
        description: '删除的技能数量',
        title: '删除数量'
    }),
}).meta({
    title: '技能更新结果',
    description: '技能更新操作的统计结果'
});

// 工作人员技能信息 Schema
export const PersonnelSkillSchema = z.object({
    serviceId: z.string().meta({
        description: '服务ID',
        title: '服务ID'
    }),
    service: ServicesSchema.meta({
        description: '服务详细信息',
        title: '服务信息'
    }),
}).meta({
    title: '工作人员技能信息',
    description: '工作人员掌握的技能和服务信息'
});

// 工作人员详细信息 Schema（包含技能列表）
export const PersonnelDetailInfoSchema = ServicePersonnelSchema.extend({
    skills: z.array(PersonnelSkillSchema).meta({
        description: '工作人员技能列表',
        title: '技能列表'
    }),
}).meta({
    title: '工作人员详细信息',
    description: '包含技能信息的工作人员详细信息'
});

// ==================== 定价管理相关 Schema ====================

// 设置服务人员定价请求 Schema
export const UpsertPersonnelPricingRequestSchema = z.object({
    serviceId: z.string().min(1, '服务ID不能为空').meta({
        description: '服务ID',
        title: '服务ID'
    }),
    price: z.string()
        .regex(/^\d+(\.\d{1,2})?$/, '价格格式不正确')
        .meta({
            description: '个人定价（字符串格式）',
            title: '个人定价'
        }),
    currency: z.string().max(3).default('CNY').meta({
        description: '币种代码',
        title: '币种代码'
    }),
}).meta({
    title: '设置服务人员定价请求',
    description: '设置或更新服务人员个人定价的请求参数'
});

// 删除服务人员定价请求 Schema
export const RemovePersonnelPricingRequestSchema = z.object({
    serviceId: z.string().min(1, '服务ID不能为空').meta({
        description: '服务ID',
        title: '服务ID'
    }),
}).meta({
    title: '删除服务人员定价请求',
    description: '删除服务人员个人定价的请求参数'
});

// 服务人员定价信息 Schema
export const PersonnelPricingInfoSchema = ServicePersonnelPricingSchema.omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
}).meta({
    title: '服务人员定价信息',
    description: '服务人员的个人定价信息'
});

// ==================== TypeScript 类型定义 ====================

export type UpsertWorkInfoRequest = z.infer<typeof UpsertWorkInfoRequestSchema>;
export type UpdatePersonnelSkillsRequest = z.infer<typeof UpdatePersonnelSkillsRequestSchema>;
export type GetPersonnelInfoRequest = z.infer<typeof GetPersonnelInfoRequestSchema>;
export type SkillUpdateResult = z.infer<typeof SkillUpdateResultSchema>;
export type PersonnelSkill = z.infer<typeof PersonnelSkillSchema>;
export type PersonnelDetailInfo = z.infer<typeof PersonnelDetailInfoSchema>;

// 定价管理相关类型
export type UpsertPersonnelPricingRequest = z.infer<typeof UpsertPersonnelPricingRequestSchema>;
export type RemovePersonnelPricingRequest = z.infer<typeof RemovePersonnelPricingRequestSchema>;
export type PersonnelPricingInfo = z.infer<typeof PersonnelPricingInfoSchema>;