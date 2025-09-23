import { AlipaySdk } from "alipay-sdk";

export function createAliPaySdk(isSandBox: boolean = false) {
    if(!process.env.ALIPAY_APP_ID) throw new Error("没有设置appId")
    if(!process.env.ALIPAY_PRIVATE_KEY) throw new Error("没有设置应用私钥")
    if(!process.env.ALIPAY_PUBLIC_KEY) throw new Error("没有设置支付宝公钥")

    const alipaySdk = new AlipaySdk({
        // 设置应用 ID
        appId: process.env.ALIPAY_APP_ID || "",
        signType: "RSA2",
        // 设置应用私钥
        privateKey: process.env.ALIPAY_PRIVATE_KEY || "",

        // 设置支付宝公钥
        alipayPublicKey:process.env.ALIPAY_PUBLIC_KEY || "",

        // 密钥类型，请与生成的密钥格式保持一致，参考平台配置一节

        // keyType: 'PKCS1',

        // 设置网关地址，默认是 https://openapi.alipay.com

        endpoint: isSandBox ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do" : "https://openapi.alipay.com",
    });

    return alipaySdk
}