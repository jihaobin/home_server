import { z } from "zod/v4"
import { UserProfilesSchema } from "./database-entity";

/**
 * 用户实名认证数据
 */
export const userAuthRealNameDataSchema = z.object({
    name: z.string().describe("姓名"),
    idcard: z.string().describe("身份证号"),
    birthday: z.string().describe("出生日期").optional(),
    res: z.union([z.string(), z.number(), z.boolean()]).describe("是否一致").transform((val) => {
        return val === true || Number(val) === 1
    }),
    passed: z.boolean().optional().describe("是否认证通过"),
    address: z.string().describe("地址").optional(),
    sex: z.string().describe("性别").optional(),
    description: z.string().describe("核验结果状态描述"),
    certifyNo: z.string().nullable().optional().describe("支付宝核验流水号"),
    score: z.string().nullable().optional().describe("人脸比对分"),
    quality: z.string().nullable().optional().describe("图像质量"),
    mismatchReason: z.string().nullable().optional().describe("未通过原因"),
}).optional()

/**
* 用户实名认证接口响应
*/
export const userAuthRealNameApiSchema = z.object({
    message: z.string().describe("提示信息"),
    // 接受字符串或数字形式的返回码（例如 "0" 或 0），统一转换为数字
    code: z.union([z.string(), z.number()]).describe("当code=0时，再判断下面result中的res；当code!=0时，表示调用已失败，无需再继续").transform((val) => Number(val)),
    // 新响应字段名为 result（当 code=0 时存在）
    result: userAuthRealNameDataSchema.optional()
})

export const userAuthRealNameApiRequestSchema = z.object({
    // 请求参数
    name: z.string().describe("姓名"),
    idcard: z.string().describe("身份证号"),
    faceImageFileId: z.string().trim().max(255).optional().describe("人脸照片文件 ID"),
})

export type UserAuthRealNameApiRequest = z.infer<typeof userAuthRealNameApiRequestSchema>;

export type userAuthRealNameApiResponse = z.infer<typeof userAuthRealNameApiSchema>;

export type UserAuthRealNameApiResponse = z.infer<typeof userAuthRealNameApiSchema>;


/**
 * 创建用户实名认证信息schema
 */
export const createUserAuthRealNameSchema = UserProfilesSchema.omit({ updatedAt: true, createdAt: true, id: true, })

/**
 * 更新用户实名认证信息
 */
export type CreateUserAuthRealName = z.infer<typeof createUserAuthRealNameSchema>

/**
 * 更新用户实名认证信息
 */
export const updateUserAuthRealNameSchema = createUserAuthRealNameSchema.partial().required({ userId: true })


/**
* 更新用户实名认证信息
*/
export type UpdateUserAuthRealName = z.infer<typeof updateUserAuthRealNameSchema>
