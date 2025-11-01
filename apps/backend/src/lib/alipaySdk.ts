import { readFileSync } from "node:fs";
import * as path from "node:path";
import { AlipaySdk } from "alipay-sdk";

export function createAliPaySdk() {
	if (!process.env.ALIPAY_APP_ID) throw new Error("没有设置appId");

	if (process.env.NODE_ENV === "development") {
		if (!process.env.ALIPAY_PRIVATE_KEY) throw new Error("没有设置应用私钥");
		if (!process.env.ALIPAY_PUBLIC_KEY) throw new Error("没有设置支付宝公钥");

		return new AlipaySdk({
			// 设置应用 ID
			appId: process.env.ALIPAY_APP_ID || "",
			signType: "RSA2",
			// 设置应用私钥
			privateKey: process.env.ALIPAY_PRIVATE_KEY || "",

			// 设置支付宝公钥
			alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || "",

			// 密钥类型，请与生成的密钥格式保持一致,参考平台配置一节
			// 设置网关地址，默认是 https://openapi.alipay.com

			endpoint: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
			gateway: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
		});
	} else {
		// 在生产环境中，证书文件会被复制到 dist/alipay_certificate 目录
		// __dirname 在编译后是 dist/src/lib，所以需要向上两级到 dist，再进入 alipay_certificate
		const certPath = path.join(__dirname, "..", "..", "alipay_certificate");

		return new AlipaySdk({
			// 设置应用 ID
			appId: process.env.ALIPAY_APP_ID,
			// 设置应用私钥
			privateKey: readFileSync(path.join(certPath, "privateKey.pem"), "ascii"),
			alipayRootCertPath: path.join(certPath, "alipayRootCert.crt"),
			alipayPublicCertPath: path.join(certPath, "alipayCertPublicKey_RSA2.crt"),
			appCertPath: path.join(certPath, "appCertPublicKey_2021006104614056.crt"),
			// 密钥类型，请与生成的密钥格式保持一致，参考平台配置一节
			// 设置网关地址，默认是 https://openapi.alipay.com
			endpoint: "https://openapi.alipay.com",
		});
	}
}
