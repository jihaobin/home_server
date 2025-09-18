import * as fs from "node:fs";
import * as path from "node:path";
import { Controller, Get } from "@nestjs/common";
import { AlipaySdk } from "alipay-sdk";
import { PayService } from "./pay.service";

// 实例化客户端
const alipaySdk = new AlipaySdk({
    // 设置应用 ID
    appId: "9021000153675106",
    signType: "RSA",
    // 设置应用私钥
    privateKey: fs.readFileSync(
        "F:/home_server/apps/backend/pay_key/private-key.pem",
        "ascii",
    ),

    // 设置支付宝公钥
    alipayPublicKey: fs.readFileSync(
        "F:/home_server/apps/backend/pay_key/alipay-public-key.pem",
        'ascii',
    ),

    // 密钥类型，请与生成的密钥格式保持一致，参考平台配置一节

    // keyType: 'PKCS1',

    // 设置网关地址，默认是 https://openapi.alipay.com

    endpoint: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
});

@Controller("pay")
export class PayController {
    constructor(private readonly payService: PayService) { }

    @Get()
    async getPayInfo() {
        const orderStr = await alipaySdk.sdkExecute('alipay.trade.app.pay', {
            bizContent: {
                out_trade_no: "ALIPfdf1211sdfsd12gfddsgs3",
                product_code: "FAST_INSTANT_TRADE_PAY",
                subject: "abc",
                body: "234",
                total_amount: "100"
            },
        });
        return orderStr;
    }
}
