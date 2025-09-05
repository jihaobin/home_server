import { optional, z } from 'zod/v4';


// ==================== 枚举定义 ====================

// 用户角色枚举
export const UserRoleEnum = z.enum(['customer', 'service_personnel', 'shop_owner', 'admin']);
export type UserRole = z.infer<typeof UserRoleEnum>;

// 订单状态枚举
export const OrderStatusEnum = z.enum([
    'pending_payment',
    'pending_assignment',
    'assigned',
    'service_in_progress',
    'completed',
    'cancelled',
    'refunded'
]);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

// 支付状态枚举
export const PaymentStatusEnum = z.enum(['pending', 'completed', 'failed', 'refunded']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

// 支付方法
export const PaymentMethodEnum = z.enum(['wechat_pay', 'alipay', 'bank_transfer']);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

// 分配类型枚举
export const AssignmentTypeEnum = z.enum(['system_auto', 'manual_assign', 'grab_order']);
export type AssignmentType = z.infer<typeof AssignmentTypeEnum>;

// 提现状态枚举
export const WithdrawalStatusEnum = z.enum(['pending', 'approved', 'rejected', 'completed']);
export type WithdrawalStatus = z.infer<typeof WithdrawalStatusEnum>;

// 通知类型枚举
export const NotificationTypeEnum = z.enum([
    'order_update',
    'payment_success',
    'service_reminder',
    'system_notice'
]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

// 优惠券类型枚举
export const CouponTypeEnum = z.enum(['percentage', 'fixed_amount']);
export type CouponType = z.infer<typeof CouponTypeEnum>;

// 优惠券状态枚举
export const CouponStatusEnum = z.enum(['active', 'inactive', 'expired']);
export type CouponStatus = z.infer<typeof CouponStatusEnum>;

// 用户优惠券状态枚举
export const UserCouponStatusEnum = z.enum(['available', 'used', 'expired']);
export type UserCouponStatus = z.infer<typeof UserCouponStatusEnum>;

// ==================== 基础表 Schema ====================

// 用户表
export const UsersSchema = z.object({
    id: z.string().max(255, '用户ID长度不能超过255个字符').meta({
        description: '用户的唯一标识符',
        title: '用户ID'
    }),
    email: z.email("请输入有效的邮箱地址")
        .max(255, '邮箱长度不能超过255个字符')
        .default('').meta({
            description: '用户的邮箱地址',
            title: '邮箱'
        }),
    emailVerified: z.boolean().default(false).meta({
        description: '邮箱是否已验证',
        title: '邮箱验证状态'
    }),
    name: z.string().max(50, '姓名长度不能超过50个字符').default('').meta({
        description: '用户的姓名',
        title: '姓名'
    }),
    sex: z.boolean().default(true).meta({
        description: '用户的性别，true-男，false-女',
        title: '性别'
    }),
    phoneNumber: z.string()
        .max(20, '手机号长度不能超过20个字符')
        .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号码')
        .optional().meta({
            description: '用户的手机号码',
            title: '手机号码'
        }),
    role: UserRoleEnum.default('customer').meta({
        description: '用户角色',
        examples:[
            'customer (客户)',
            'service_personnel (服务人员)',
            'shop_owner (店主)',
            'admin (管理员)',
        ]
        }),
    isActive: z.boolean().default(true).meta({
        title: "该用户是否可用"
    }),
    image: z.string().max(255, '头像URL长度不能超过255个字符').default('').meta({
        description: '用户头像的URL',
        title: '头像URL'
    }),
    createdAt: z.date().meta({
        description: '用户创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().optional().meta({
        description: '用户更新时间',
        title: '更新时间'
    }),
    phoneNumberVerified: z.boolean().meta({
        description: '手机号码是否已验证',
        title: '手机号码验证状态'
    }),
}).meta({
    title: '用户表',
    description: '存储用户信息的表'
});

// 中国城市表
export const ChinaCitySchema = z.object({
    id: z.number().int().meta({
        description: '省份/市/区的唯一标识符',
        title: '省份/市/区 ID'
    }),
    pid: z.number().int().meta({
        description: '父级ID，0表示省级',
        title: '父级ID'
    }),
    deep: z.number().int().meta({
        description: '深度，0表示省，1表示市，2表示区县',
        title: '深度'
    }),
    name: z.string().max(255).meta({
        description: '省份/市/区的名称',
        title: "省份/市/区的名称"
    }),
    pinyinPrefix: z.string().max(255).meta({
        description: '拼音首字母',
        title: '拼音首字母'
    }),
    pinyin: z.string().max(255).meta({
        description: '拼音',
        title: '拼音'
    }),
    extId: z.string().max(255).meta({
        description: '外部ID',
        title: '外部ID'
    }),
    extName: z.string().max(255).meta({
        description: '外部名称',
        title: '外部名称'
    }),
}).meta({
    title: '中国城市表',
    description: '存储中国省市区数据的表'
});

// 验证表
export const VerificationsSchema = z.object({
    id: z.string().max(255),
    identifier: z.string().meta({
        description: '验证标识符',
        title: '标识符'
    }),
    value: z.string().meta({
        description: '验证值',
        title: '值'
    }),
    expiresAt: z.date().meta({
        description: '过期时间',
        title: '过期时间'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().optional().meta({
        description: '更新时间',
        title: '更新时间'
    }),
}).meta({
    title: '验证表',
    description: '存储用户验证信息的表'
});

// ==================== 有外键关系的表 Schema ====================

// 认证信息表（用户第三方登录，关联用户）
export const AccountsSchema = z.object({
    id: z.string().max(255).meta({
        description: '账户的唯一标识符',
        title: '账户ID'
    }),
    accountId: z.string().max(255).meta({
        description: '账户ID',
        title: '账户ID'
    }),
    providerId: z.string().max(255).meta({
        description: '第三方登录提供商ID',
        title: '提供商ID'
    }),
    userId: z.string().max(255).meta({
        description: '用户ID',
        title: '用户ID'
    }),
    accessToken: z.string().optional().meta({
        description: '访问令牌',
        title: '访问令牌'
    }),
    refreshToken: z.string().optional().meta({
        description: '刷新令牌',
        title: '刷新令牌'
    }),
    idToken: z.string().optional().meta({
        description: 'ID令牌',
        title: 'ID令牌'
    }),
    accessTokenExpiresAt: z.date().optional().meta({
        description: '访问令牌过期时间',
        title: '访问令牌过期时间'
    }),
    refreshTokenExpiresAt: z.date().optional().meta({
        description: '刷新令牌过期时间',
        title: '刷新令牌过期时间'
    }),
    scope: z.string().optional().meta({
        description: '访问范围',
        title: '访问范围'
    }),
    password: z.string().optional().meta({
        description: '账户密码',
        title: '账户密码'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().optional().meta({
        description: '更新时间',
        title: '更新时间'
    }),
}).meta({
    title: '第三方认证账户表',
    description: '存储用户认证信息的表'
});

// 会话表（用户会话信息，关联用户）
export const SessionsSchema = z.object({
    id: z.string().max(255).meta({
        description: '会话的唯一标识符',
        title: '会话ID'
    }),
    expiresAt: z.date().meta({
        description: '会话过期时间',
        title: '过期时间'
    }),
    token: z.string().max(255).meta({
        description: '会话令牌',
        title: '令牌'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '会话创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().optional().meta({
        description: '会话更新时间',
        title: '更新时间'
    }),
    ipAddress: z.string().optional().meta({
        description: '用户IP地址',
        title: 'IP地址'
    }),
    userAgent: z.string().optional().meta({
        description: '用户设备信息',
        title: '设备信息'
    }),
    userId: z.string().max(255).meta({
        description: '用户ID',
        title: '用户ID'
    }),
}).meta({
    title: '会话表',
    description: '存储用户会话信息的表'
});

// 用户资料表（关联用户，用于实名认证）
export const UserProfilesSchema = z.object({
    id: z.string().max(255).meta({
        description: '用户资料ID',
        title: '用户资料ID'
    }),
    userId: z.string().max(255).meta({
        description: '用户ID',
        title: '用户ID'
    }),
    realName: z.string().max(50).meta({
        description: '真实姓名',
        title: '真实姓名'
    }),
    idCardNumber: z.string()
        .max(18)
        .regex(/^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/, '请输入有效的身份证号码'),
    faceRecognitionData: z.string().optional().meta({
        description: '人脸识别数据',
        title: '人脸识别数据'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().default(() => new Date()).meta({
        description: '更新时间',
        title: '更新时间'
    }),
}).meta({
    title: '用户资料表',
    description: '存储用户实名信息的表'
});

// 店铺表（关联用户）
export const ShopsSchema = z.object({
    id: z.string().max(255).meta({
        description: '店铺ID',
        title: '店铺ID'
    }),
    ownerId: z.string().max(255).meta({
        description: '店主ID',
        title: '店主ID'
    }),
    name: z.string().max(100).meta({
        description: '店铺名称',
        title: '店铺名称'
    }),
    description: z.string().optional().meta({
        description: '店铺描述',
        title: '店铺描述'
    }),
    detailedAddress: z.string().max(255).optional().meta({
        description: '店铺详细地址',
        title: '店铺详细地址'
    }),
    homeNumber: z.string().max(50).optional().meta({
        description: '门牌号',
        title: '门牌号'
    }),
    geom: z.string().optional().meta({
        description: '店铺位置',
        title: '店铺位置'
    }), // 几何点数据，存储为WKT格式
    createdAt: z.date().default(() => new Date()).meta({
        description: '创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().default(() => new Date()).meta({
        description: '更新时间',
        title: '更新时间'
    }),
    province: z.string().max(100).optional().meta({
        description: '省份',
        title: '省份'
    }),
    district: z.string().max(100).optional().meta({
        description: '市区',
        title: '市区'
    }),
    county: z.string().max(100).optional().meta({
        description: '区/县',
        title: '区/县'
    }),
}).meta({
    title: '店铺表',
    description: '存储店铺信息的表'
});

// 服务分类表（自关联）
export const ServiceCategoriesSchema = z.object({
    id: z.string().max(255).meta({
        description: '服务分类ID',
        title: '服务分类ID'
    }),
    parentId: z.string().max(15).optional().meta({
        description: '父分类ID，根分类为null',
        title: '父分类ID'
    }),
    name: z.string().max(100).meta({
        description: '服务分类名称',
        title: '服务分类名称'
    }),
    description: z.string().optional().meta({
        description: '服务分类描述',
        title: '服务分类描述'
    }),
    dep: z.number().int().min(1).optional().meta({
        description: '服务分类深度',
        title: '服务分类深度'
    }),
    isActive: z.boolean().default(true).meta({
        description: '服务分类是否启用',
        title: '服务分类是否启用'
    }),
}).meta({
    title: '服务分类表',
    description: '存储服务分类信息的表'
});

// 服务表（关联服务分类）
export const ServicesSchema = z.object({
    id: z.string().max(255).meta({
        description: '服务ID',
        title: '服务ID'
    }),
    categoryId: z.string().max(15).meta({
        description: '服务分类ID',
        title: '服务分类ID'
    }),
    name: z.string().max(100).meta({
        description: '服务名称',
        title: '服务名称'
    }),
    description: z.string().optional().meta({
        description: '服务描述',
        title: '服务描述'
    }),
    basePrice: z.number().meta({
        description: '服务基础价格',
        title: '服务基础价格'
    })
        .multipleOf(0.01, '价格精度为分')
        .min(0, '价格不能为负数'),
    estimatedDurationMinutes: z.number().int().min(1, '预估时长必须大于0分钟').optional().meta({
        description: '预估服务时长（分钟）',
        title: '预估服务时长（分钟）'
    }),
    isActive: z.boolean().default(true).meta({
        description: '服务是否可用',
        title: '服务可用状态'
    }),
}).meta({
    title: '服务表',
    description: '存储服务信息的表'
});

// 服务人员表（关联用户和店铺）
export const ServicePersonnelSchema = z.object({
    userId: z.string().max(255).meta({
        description: '服务人员用户ID',
        title: '服务人员用户ID'
    }),
    shopId: z.string().max(255).optional().meta({
        description: '服务人员所属店铺ID',
        title: '服务人员所属店铺ID'
    }),
    bio: z.string().optional().meta({
        description: '服务人员简介',
        title: '服务人员简介'
    }),
    yearsOfExperience: z.number().int().min(0, '工作经验不能为负数').default(0).meta({
        description: '服务人员工作经验（年）',
        title: '服务人员工作经验（年）'
    }),
    workStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '请输入有效的时间格式 HH:MM').optional().meta({
        description: '服务人员工作开始时间',
        title: '服务人员工作开始时间'
    }),
    workEndTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '请输入有效的时间格式 HH:MM').optional().meta({
        description: '服务人员工作结束时间',
        title: '服务人员工作结束时间'
    }),
    isAvailable: z.boolean().default(true).meta({
        description: '服务人员是否可用',
        title: '服务人员可用状态'
    }),
}).refine((data) => {
    if (data.workStartTime && data.workEndTime) {
        return data.workStartTime < data.workEndTime;
    }
    return true;
}, {
    message: '工作结束时间必须晚于开始时间',
    path: ['workEndTime'],
}).meta({
    title: '服务人员表',
    description: '存储服务人员信息的表'
});

// 服务人员技能关联表
export const ServicePersonnelSkillsSchema = z.object({
    userId: z.string().max(255).meta({
        description: '服务人员用户ID',
        title: '服务人员用户ID'
    }),
    serviceId: z.string().max(255).meta({
        description: '服务ID',
        title: '服务ID'
    }),
}).meta({
    title: '服务人员技能关联表',
    description: '存储服务人员与技能关联信息的表'
});

// 用户地址表（关联用户）
export const UserAddressesSchema = z.object({
    id: z.string("id 不能为空").max(255, "id 不能超过255个字符").meta({
        description: '地址ID',
        title: '地址ID'
    }),
    userId: z.string("userId 不能为空").max(255, "userId 不能超过255个字符").meta({
        description: '用户ID',
        title: '用户ID'
    }),
    detailedAddress: z.string("地址不能为空").max(255, "detailedAddress 不能超过255个字符").meta({
        description: '详细地址',
        title: '详细地址'
    }),
    addressName: z.string().max(100, "地点名称不能超过100个字符").optional().meta({
        description: '地点名称',
        title: '地点名称，如xx小区,xx餐馆'
    }),
    homeNumber: z.string().max(50, "门牌号不能超过50个字符").optional().meta({
        description: '门牌号',
        title: '门牌号'
    }),
    geom: z.array(z.number()).length(2).optional().meta({
        description: '[经度, 纬度]',
        title: '[经度, 纬度]'
    }),
    recipientName: z.string("收件人不能为空").max(50, "收件人姓名不能超过50个字符").meta({
        description: '收件人姓名',
        title: '收件人姓名'
    }),
    sex: z.boolean().default(true).meta({
        description: '收货人的性别，true-男，false-女',
        title: '性别'
    }),
    recipientPhone: z.string("收件人手机号码不能为空").max(20, "收件人手机号码不能超过20个字符").regex(/^1[3-9]\d{9}$/, '请输入有效的手机号码').meta({
        description: '收件人手机号码',
        title: '收件人手机号码'
    }),
    isDefault: z.boolean("是否为默认地址不能为空").default(false).meta({
        description: '是否为默认地址',
        title: '默认地址状态'
    }),
    province: z.string("省份不能为空").max(100, "省份不能超过100个字符").meta({
        description: '省份',
        title: '省份'
    }),
    city: z.string().max(100, "城市不能超过100个字符").optional().meta({
        description: '市',
        title: '市'
    }),
    district: z.string("district 不能为空").max(100, "区/县不能超过100个字符").optional().meta({
        description: '区/县',
        title: '区/县'
    }),

}).meta({
    title: '用户地址表',
    description: '存储用户地址信息的表'
});

// 优惠券表（关联创建者）
export const CouponsSchema = z.object({
    id: z.string().max(255).meta({
        description: '优惠券ID',
        title: '优惠券ID'
    }),
    code: z.string().max(50).meta({
        description: '优惠券代码',
        title: '优惠券代码'
    }),
    name: z.string().max(100).meta({
        description: '优惠券名称',
        title: '优惠券名称'
    }),
    description: z.string().optional().meta({
        description: '优惠券描述',
        title: '优惠券描述'
    }),
    type: CouponTypeEnum.meta({
        description: '优惠券类型',
        title: '优惠券类型',
        examples: [
            'percentage (百分比折扣)',
            'fixed_amount (固定金额折扣)'
        ]
    }),
    discountValue: z.number()
        .multipleOf(0.01)
        .min(0.01, '折扣值必须大于0').meta({
            description: '折扣值',
            title: '折扣值'
        }),
    minOrderAmount: z.number()
        .multipleOf(0.01)
        .min(0, '最小订单金额不能为负数')
        .default(0).meta({
            description: '使用优惠券的最小订单金额',
            title: '最小订单金额'
        }),
    maxDiscountAmount: z.number().multipleOf(0.01).optional().meta({
        description: '最大折扣金额（仅适用于固定金额优惠券）',
        title: '最大折扣金额'
    }),
    usageLimit: z.number().int().min(1, '使用限制必须大于0').default(1).meta({
        description: '每个用户使用优惠券的限制次数',
        title: '使用限制'
    }),
    totalUsageLimit: z.number().int().min(1, '总使用限制必须大于0').optional().meta({
        description: '优惠券的总使用限制次数',
        title: '总使用限制'
    }),
    currentUsageCount: z.number().int().min(0, '当前使用次数不能为负数').default(0).meta({
        description: '优惠券的当前使用次数',
        title: '当前使用次数'
    }),
    isMultiUse: z.boolean().default(false).meta({
        description: '优惠券是否支持多次使用',
        title: '是否多次使用'
    }),
    validFrom: z.date().meta({
        description: '优惠券生效开始时间',
        title: '生效开始时间'
    }),
    validUntil: z.date().meta({
        description: '优惠券生效结束时间',
        title: '生效结束时间'
    }),
    status: CouponStatusEnum.default('active').meta({
        description: '优惠券状态',
        title: '状态'
    }),
    createdBy: z.string().max(15).optional().meta({
        description: '创建者用户ID',
        title: '创建者'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().default(() => new Date()).meta({
        description: '更新时间',
        title: '更新时间'
    }),
}).refine((data) => data.validFrom < data.validUntil, {
    message: '有效期开始时间必须早于结束时间',
    path: ['validUntil'],
}).refine((data) => {
    if (data.type === 'percentage') {
        return data.discountValue <= 100;
    }
    return true;
}, {
    message: '百分比折扣不能超过100%',
    path: ['discountValue'],
}).meta({
    title: '优惠券表',
    description: '存储优惠券信息的表'
});

// 优惠券分类限制表
export const CouponCategoryRestrictionsSchema = z.object({
    id: z.string().max(255).meta({
        description: '优惠券分类限制ID',
        title: '优惠券分类限制ID'
    }),
    couponId: z.string().max(15).meta({
        description: '优惠券ID',
        title: '优惠券ID'
    }),
    categoryId: z.string().max(15).meta({
        description: '分类ID',
        title: '分类ID'
    }),
}).meta({
    title: '优惠券分类限制表',
    description: '存储优惠券分类限制信息的表'
});

// 优惠券服务限制表
export const CouponServiceRestrictionsSchema = z.object({
    id: z.string().max(255).meta({
        description: '优惠券服务限制ID',
        title: '优惠券服务限制ID'
    }),
    couponId: z.string().max(15).meta({
        description: '优惠券ID',
        title: '优惠券ID'
    }),
    serviceId: z.string().max(15).meta({
        description: '服务ID',
        title: '服务ID'
    }),
}).meta({
    title: '优惠券服务限制表',
    description: '存储优惠券服务限制信息的表'
});

// 用户优惠券表
export const UserCouponsSchema = z.object({
    id: z.string().max(255).meta({
        description: '用户优惠券ID',
        title: '用户优惠券ID'
    }),
    userId: z.string().max(15).meta({
        description: '用户ID',
        title: '用户ID'
    }),
    couponId: z.string().max(15).meta({
        description: '优惠券ID',
        title: '优惠券ID'
    }),
    status: UserCouponStatusEnum.default('available').meta({
        description: '用户优惠券状态',
        title: '用户优惠券状态'
    }),
    usedCount: z.number().int().min(0, '使用次数不能为负数').default(0).meta({
        description: '用户优惠券使用次数',
        title: '用户优惠券使用次数'
    }),
    obtainedAt: z.date().default(() => new Date()).meta({
        description: '用户获得优惠券时间',
        title: '用户获得优惠券时间'
    }),
    firstUsedAt: z.date().optional().meta({
        title: '首次使用时间',
        description: '用户首次使用优惠券的时间'
    }),
    lastUsedAt: z.date().optional().meta({
        title: '最后使用时间',
        description: '用户最后使用优惠券的时间'
    }),
}).meta({
    title: '用户优惠券表',
    description: '存储用户优惠券信息的表'
});

// 订单表（关联用户、服务、地址）
export const OrdersSchema = z.object({
    id: z.string().max(255).meta({
        description: '订单ID',
        title: '订单ID'
    }),
    orderSerial: z.string().max(50).meta({
        description: '订单编号',
        title: '订单编号'
    }),
    customerId: z.string().max(255).meta({
        description: '客户ID',
        title: '客户ID'
    }),
    serviceId: z.string().max(15).meta({
        description: '服务ID',
        title: '服务ID'
    }),
    addressId: z.string().max(15).meta({
        description: '地址ID',
        title: '地址ID'
    }),
    status: OrderStatusEnum.default('pending_payment').meta({
        description: '订单状态',
        title: '订单状态',
        examples: [
            'pending_payment (待支付)',
            'pending_assignment (待分配)',
            'assigned (已分配)',
            'service_in_progress (服务进行中)',
            'completed (已完成)',
            'cancelled (已取消)',
            'refunded (已退款)'
        ]
    }),
    originalAmount: z.number()
        .multipleOf(0.01)
        .min(0, '原始金额不能为负数').meta({
            title: "原始金额",
            description: "原始金额"
        }),
    discountAmount: z.number()
        .multipleOf(0.01)
        .min(0, '折扣金额不能为负数')
        .default(0).meta({
            title: "折扣金额",
            description: "折扣金额"
        }),
    totalAmount: z.number()
        .multipleOf(0.01)
        .min(0, '总金额不能为负数').meta({
            title: "总金额",
            description: "总金额"
        }),
    couponCode: z.string().max(50).optional().meta({
        description: '使用的优惠券代码',
        title: '使用的优惠券代码'
    }),
    appointmentTime: z.date().meta({
        description: '服务预约时间',
        title: '服务预约时间'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '订单创建时间',
        title: '创建时间'
    }),
    updatedAt: z.date().default(() => new Date()).meta({
        description: '订单更新时间',
        title: '更新时间'
    }),
}).refine((data) => data.totalAmount <= data.originalAmount, {
    message: '总金额不能超过原始金额',
    path: ['totalAmount'],
}).refine((data) => data.appointmentTime > new Date(), {
    message: '预约时间必须是未来时间',
    path: ['appointmentTime'],
}).meta({
    title: '订单表',
    description: '存储订单信息的表'
});

// 订单分配表（关联订单、服务人员、店铺）
export const OrderAssignmentsSchema = z.object({
    id: z.string().max(255).meta({
        description: '订单分配ID',
        title: '订单分配ID'
    }),
    orderId: z.string().max(255).meta({
        description: '订单ID',
        title: '订单ID'
    }),
    servicePersonnelId: z.string().max(15).optional().meta({
        description: '服务人员ID',
        title: '服务人员ID'
    }),
    shopId: z.string().max(15).optional().meta({
        description: '店铺ID',
        title: '店铺ID'
    }),
    assignmentType: AssignmentTypeEnum.meta({
        description: '订单分配类型',
        title: '订单分配类型',
        examples: [
            'system_auto (系统自动分配)',
            'manual_assign (手动分配)',
            'grab_order (抢单)'
        ]
    }),
    assignedAt: z.date().default(() => new Date()).meta({
        description: '订单分配时间',
        title: '分配时间',
    }),
}).refine((data) => {
    return data.servicePersonnelId || data.shopId;
}, {
    message: '必须指定服务人员或店铺',
    path: ['servicePersonnelId'],
}).meta({
    title: '订单分配表',
    description: '存储订单分配信息的表'
});

// 支付表（关联订单）
export const PaymentsSchema = z.object({
    id: z.string().max(255).meta({
        description: '支付ID',
        title: '支付ID'
    }),
    orderId: z.string().max(255).meta({
        description: '订单ID',
        title: '订单ID'
    }),
    amount: z.number()
        .multipleOf(0.01)
        .min(0, '支付金额不能为负数').meta({
            description: '支付金额',
            title: '支付金额'
        }),
    paymentMethod: PaymentMethodEnum.meta({
        description: '支付方式',
        title: '支付方式',
        examples: [
            'alipay (支付宝)',
            'wechat_pay (微信支付)',
            'bank_transfer (银行转账)'
        ]
    }),
    transactionId: z.string().max(255).optional().meta({
        description: '交易ID',
        title: '交易ID'
    }),
    status: PaymentStatusEnum.default('pending').meta({
        description: '支付状态',
        title: '支付状态',
        examples: [
           'pending (待支付)',
           'completed (已完成)',
           'failed (支付失败)',
           'refunded (已退款)'
        ]
    }),
    paidAt: z.date().optional().meta({
        description: '支付完成时间',
        title: '支付完成时间'
    }),
}).meta({
    title: '支付表',
    description: '存储支付信息的表'
});

// 屏蔽关系表（用户间关系）
export const BlocksSchema = z.object({
    blockerId: z.string().max(255).meta({
        description: '屏蔽者用户ID',
        title: '屏蔽者用户ID'
    }),
    blockedId: z.string().max(255).meta({
        description: '被屏蔽者用户ID',
        title: '被屏蔽者用户ID'
    }),
}).refine((data) => data.blockerId !== data.blockedId, {
    message: '不能屏蔽自己',
    path: ['blockedId'],
}).meta({
    title: '屏蔽关系表',
    description: '存储用户间屏蔽关系的表'
});

// 关注关系表（用户间关系）
export const FollowsSchema = z.object({
    followerId: z.string().max(255).meta({
        description: '关注者用户ID',
        title: '关注者用户ID'
    }),
    followingId: z.string().max(255).meta({
        description: '被关注者用户ID',
        title: '被关注者用户ID'
    }),
}).refine((data) => data.followerId !== data.followingId, {
    message: '不能关注自己',
    path: ['followingId'],
}).meta({
    title: '关注关系表',
    description: '存储用户服务关系的表'
});

// 评价表（关联订单和用户）
export const ReviewsSchema = z.object({
    id: z.string().max(255).meta({
        description: '评价ID',
        title: '评价ID'
    }),
    orderId: z.string().max(255).meta({
        description: '订单ID',
        title: '订单ID'
    }),
    reviewerId: z.string().max(255).meta({
        description: '评价者用户ID',
        title: '评价者用户ID'
    }),
    targetId: z.string().max(15).meta({
        description: '被评价对象ID',
        title: '被评价对象ID'
    }),
    targetType: z.string().max(50).meta({
        description: '被评价对象类型',
        title: '被评价对象类型'
    }),
    rating: z.number().int()
        .min(1, '评分不能低于1分')
        .max(5, '评分不能超过5分'),
    comment: z.string().optional().meta({
        description: '评价内容',
        title: '评价内容'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '评价创建时间',
        title: '评价创建时间'
    }),
}).meta({
    title: '评价表',
    description: '存储用户对订单的评价信息'
});

// 收入表（关联订单和用户）
export const EarningsSchema = z.object({
    id: z.string().max(255).meta({
        description: '收入记录ID',
        title: '收入记录ID'
    }),
    orderId: z.string().max(15).meta({
        description: '订单ID',
        title: '订单ID'
    }),
    userId: z.string().max(15).meta({
        description: '用户ID',
        title: '用户ID'
    }),
    amount: z.number()
        .multipleOf(0.01)
        .min(0, '收入金额不能为负数').meta({
            description: '收入金额',
            title: '收入金额'
        }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '收入记录创建时间',
        title: '收入记录创建时间'
    }),
}).meta({
    title: '收入表',
    description: '存储用户收入记录的表'
});

// 提现表（关联用户）
export const WithdrawalsSchema = z.object({
    id: z.string().max(255).meta({
        description: '提现记录ID',
        title: '提现记录ID'
    }),
    userId: z.string().max(255).meta({
        description: '用户ID',
        title: '用户ID'
    }),
    amount: z.number()
        .multipleOf(0.01)
        .min(0.01, '提现金额必须大于0').meta({
            description: '提现金额',
            title: '提现金额'
        }),
    status: WithdrawalStatusEnum.default('pending').meta({
        description: '提现状态',
        title: '提现状态',
        examples: [
           'pending (待处理)',
           'approved (已批准)',
           'rejected (已拒绝)',
           'completed (已完成)'
        ]
    }),
    requestedAt: z.date().default(() => new Date()).meta({
        description: '提现申请时间',
        title: '提现申请时间'
    }),
    processedAt: z.date().optional().meta({
        description: '提现处理时间',
        title: '提现处理时间'
    }),
}).meta({
    title: '提现表',
    description: '存储用户提现记录的表'
});

// 通知表（关联用户）
export const NotificationsSchema = z.object({
    id: z.string().max(255).meta({
        description: '通知ID',
        title: '通知ID'
    }),
    userId: z.string().max(255).meta({
        description: '用户ID',
        title: '用户ID'
    }),
    type: NotificationTypeEnum.meta({
        description: '通知类型',
        title: '通知类型',
        examples: [
            'order_update (订单更新)',
            'payment_success (支付成功)',
            'service_reminder (服务提醒)',
            'system_notice (系统通知)'
        ]
    }),
    title: z.string().max(255).meta({
        description: '通知标题',
        title: '通知标题'
    }),
    message: z.string().optional().meta({
        description: '通知内容',
        title: '通知内容'
    }),
    isRead: z.boolean().default(false).meta({
        description: '是否已读',
        title: '是否已读'
    }),
    createdAt: z.date().default(() => new Date()).meta({
        description: '创建时间',
        title: '创建时间'
    }),
}).meta({
    title: '通知表',
    description: '存储用户通知信息的表'
});

// 优惠券使用记录表
export const CouponUsageRecordsSchema = z.object({
    id: z.string().max(255).meta({
        description: '优惠券使用记录ID',
        title: '优惠券使用记录ID'
    }),
    userCouponId: z.string().max(15).meta({
        description: '用户优惠券ID',
        title: '用户优惠券ID'
    }),
    orderId: z.string().max(15).meta({
        description: '订单ID',
        title: '订单ID'
    }),
    discountAmount: z.number()
        .multipleOf(0.01)
        .min(0, '折扣金额不能为负数').meta({
            description: '折扣金额',
            title: '折扣金额'
        }),
    originalAmount: z.number()
        .multipleOf(0.01)
        .min(0, '原始金额不能为负数').meta({
            description: '原始金额',
            title: '原始金额'
        }),
    finalAmount: z.number()
        .multipleOf(0.01)
        .min(0, '最终金额不能为负数').meta({
            description: '最终金额',
            title: '最终金额'
        }),
    usedAt: z.date().default(() => new Date()).meta({
        description: '使用时间',
        title: '使用时间'
    }),
}).refine((data) => data.finalAmount <= data.originalAmount, {
    message: '最终金额不能超过原始金额',
    path: ['finalAmount'],
}).meta({
    title: '优惠券使用记录表',
    description: '存储用户优惠券使用记录的表'
});

// ==================== 创建和更新 Schema ====================

// 创建用户 Schema（排除自动生成字段）
export const CreateUserSchema = UsersSchema.omit({
    createdAt: true,
    updatedAt: true,
});

// 更新用户 Schema（所有字段可选，排除ID）
export const UpdateUserSchema = UsersSchema.omit({
    id: true,
    createdAt: true,
}).partial();

// 创建订单 Schema
export const CreateOrderSchema = OrdersSchema.omit({
    id: true,
    orderSerial: true,
    createdAt: true,
    updatedAt: true,
});

// 更新订单 Schema
export const UpdateOrderSchema = OrdersSchema.omit({
    id: true,
    orderSerial: true,
    customerId: true,
    createdAt: true,
}).partial();

// ==================== 导出所有类型 ====================

export type Users = z.infer<typeof UsersSchema>;
export type Accounts = z.infer<typeof AccountsSchema>;
export type Sessions = z.infer<typeof SessionsSchema>;
export type Verifications = z.infer<typeof VerificationsSchema>;
export type UserProfiles = z.infer<typeof UserProfilesSchema>;
export type Shops = z.infer<typeof ShopsSchema>;
export type ServiceCategories = z.infer<typeof ServiceCategoriesSchema>;
export type Services = z.infer<typeof ServicesSchema>;
export type ServicePersonnel = z.infer<typeof ServicePersonnelSchema>;
export type ServicePersonnelSkills = z.infer<typeof ServicePersonnelSkillsSchema>;
export type UserAddresses = z.infer<typeof UserAddressesSchema>;
export type Orders = z.infer<typeof OrdersSchema>;
export type OrderAssignments = z.infer<typeof OrderAssignmentsSchema>;
export type Payments = z.infer<typeof PaymentsSchema>;
export type Blocks = z.infer<typeof BlocksSchema>;
export type Follows = z.infer<typeof FollowsSchema>;
export type Reviews = z.infer<typeof ReviewsSchema>;
export type Earnings = z.infer<typeof EarningsSchema>;
export type Withdrawals = z.infer<typeof WithdrawalsSchema>;
export type Notifications = z.infer<typeof NotificationsSchema>;
export type Coupons = z.infer<typeof CouponsSchema>;
export type CouponCategoryRestrictions = z.infer<typeof CouponCategoryRestrictionsSchema>;
export type CouponServiceRestrictions = z.infer<typeof CouponServiceRestrictionsSchema>;
export type UserCoupons = z.infer<typeof UserCouponsSchema>;
export type CouponUsageRecords = z.infer<typeof CouponUsageRecordsSchema>;
export type ChinaCity = z.infer<typeof ChinaCitySchema>;

// 创建和更新类型
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;