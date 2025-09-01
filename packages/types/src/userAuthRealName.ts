import { z } from "zod/v4"

/**
 * 用户实名认证数据
 */
export const userAuthRealNameDataSchema = z.object({
    birthday: z.string().describe("出生日期"),
    result: z.number().describe("是否一致 1为不一致，0为一致").transform((val) => {
        return val === 0;
    }),
    address: z.string().describe("地址"),
    orderNo: z.string().describe("订单号"),
    sex: z.string().describe("性别"),
    desc: z.string().describe("描述")
}).optional()

/**
* 用户实名认证接口响应
*/
export const userAuthRealNameApiSchema = z.object({
    msg: z.string().describe("提示信息"),
    success: z.boolean().optional().describe("请求是否成功"),
    code: z.number().describe("状态码,code为200 data才会有值，400参数格式错误"),
    data: userAuthRealNameDataSchema
})

export const userAuthRealNameApiRequestSchema = z.object({
    // 请求参数
    name: z.string().describe("姓名"),
    idcard: z.string().describe("身份证号")
})

export type UserAuthRealNameApiRequest = z.infer<typeof userAuthRealNameApiRequestSchema>;

export type userAuthRealNameApiResponse = z.Infer<typeof userAuthRealNameApiSchema>;

export type UserAuthRealNameApiResponse = z.infer<typeof userAuthRealNameApiSchema>;
