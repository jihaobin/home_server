import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AlipaySdk } from "alipay-sdk";
import { SkipTransform } from "src/common/interceptors";
import type { PayService } from "./pay.service";

// 实例化客户端
const alipaySdk = new AlipaySdk({
	// 设置应用 ID
	appId: "9021000153675106",
	signType: "RSA2",
	// 设置应用私钥
	privateKey:
		"MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCuPEu4ejPIM1E5mGG6aGH2UYOfFCoiTkdMdJWzixM/7tG56rP6g77LdDxRMqUTLWfyjrDGfyOTHgQbP8JoR+8fO1IOPGAtGuT+oi2yIHWSkObJvuLjSItjTpf2y6f1zrfhV1Vv+6S13jr3XMuc6t6qazNhR0CFoSM6o4to6ggu48X8F5eMfjev9I4bFD5gY1LohxvDAsRR3f7yCTUSrPSKScuIx3cq2I5imA5aQCS5zCvpjacAoV+xTGvDyaeFbNsD7iXP3fTbJiHjwSBc31u266jvCc967eHksXoYDP2YlW355X6sZVLEhaxAs8Uw1dXoV4gWjNwUaeiZJ6h7J0PPAgMBAAECggEABiWKZk+pU/67dtSxXeogypfFlO8ZLWylh0T1owfc/fxm2bA1+Th8mqDXH+YxfKO1bxEpm1cQ4jfE3VE6goNHJErrciUfH3g7a+A8zHPoser6uVNKncoJYM98/O/iVQGd6w0xrmmqPeBBJEjZxgdjI4/0mBHzbMNqgr8SQ/k9oKnJfS2A2GwDBE0EEaGdNkKbgZe4ejPTRGo/e7TDZjPIWUR5wFONcQS6IILhrdN4tnTfUafHo2rJwW9vRDzn3ndTce66QUG72SjUmxGEZgyrDQKNh2y8wnOWBvyav8VjFjzbQU1YD+AqxpGZ0dJorg9MYgsh6QRorcHmnI37+B/ngQKBgQDfuSlEUELEe5Z34FW6F3HChD6qDKX73GvXK/J0n9I6DFyF2LQKclvXSHS6+nRY1z5Uvhg+PLW2kbeumixPQQqi96fpmbScMY+2gOxzPEugq0itNJdHx6OtUMHhgRGHSM4zQ5iywpfBv9gTxmhnMvgXKSnJw2box4RBysy7sMME6QKBgQDHX2N4q06OoVGk/sP1rtUFvWSPnfgUnLJjWYyp+ZauaspkKNhShqQ6ghv/JMMZn3/p71K4Im8S9AtcM8hLfgz4IUsWH5MUIm0IoQun3EBXpgiSGPp7Y4dGAl8ELKtsKpSSnIuJyQCmavKlYsuIdXQQF9BLmG2DcrOP8iolsSjv9wKBgQCzoqsd7QwPU+S3kGuFJnnzY9glFk7Ycl4swV7GgeV9Mpu/5QZ7NOPFcqo30A5Hn1yvEovIvVpyo4JHMgfOAz2VKSGsEfzRRYJNWiuBQ7K96YpLeOTXf9dOvH9QoCAA7laTFv2u20ybB31qM291HZnSjvy8wqcI1dq+MSY+tmmAsQKBgEbXnynGfSBzM+aT3B+VYv4qIOxjLj5su3pP3IqdNCx/p7DVTqBsVTiw+K+9aVHWegYu0s649YzfiJXXlIk2nfchJWQUDhfub53MU67utTIvvgXjuEVVxUBcIVUDZloF+0rpMy/fa0q238dihn3Tdk0tmQbzf55giGtSmiVQgQJbAoGBAL6ayj1Bx00uOEU9Jp2CuzcuSPszkFwQ5rKNs5cBfaftFQrzeghNfixVGmMAN3679rWITiKBS6346PDgA8R0ZhbNSQ+tmXzLoFiDHVvRV56LvMT+Kpf+awF41QOaJ+5pEkjuV6TO1UQS3Fr2kDHjvlONlGmXF/Svm+o/zlXIQS6Z",

	// 设置支付宝公钥
	alipayPublicKey:
		"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3ln/fUhYapD0Qj9tonGMD/gdl0iYwyl23NB2VQCTnZtE/BLlQYlsI8XgCMFM+YnTx+E08T7SWNgPv8G2gBH4SKz0umusBO91wP6SaGb44jKI2D/8894gMzrD8cPEci/6Oir4cCI2deAe96G1Kt/4UYx64+IyeXwdjLqKGG+0sQikXJNnWEp/msAW1FVanRdvQaYOhLCKXDMlTY5xSe92ZzA9//gerT3qcvhFdqaxn3sJhQ/d3IwqSGtDxaQYh3lKufEYjnwiRCN3iOXxojgCkgd6garVIkJpD7NwmJ0KW42MWz1q+zgwvexl6TgVbieoYzCZAGSlZi5QaNd6DRn9NQIDAQAB",

	// 密钥类型，请与生成的密钥格式保持一致，参考平台配置一节

	// keyType: 'PKCS1',

	// 设置网关地址，默认是 https://openapi.alipay.com

	endpoint: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
});

@Controller("pay")
export class PayController {
	// constructor(private readonly payService: PayService) {}

	@Get()
	getPayInfo() {
		const orderStr = alipaySdk.sdkExecute("alipay.trade.app.pay", {
			bizContent: {
				out_trade_no: "asdpouarivobsfdgoprutdsf",
				product_code: "234dvbxvpugiouretpufgsp",
				subject: "abc",
				body: "234",
				total_amount: "0.01",
			},
			notify_url: " http://sfc9d8c6.natappfree.cc/api/pay/notify",
		});
		return orderStr;
	}

	@SkipTransform()
	@Post("notify")
	notify(@Body() info:{a:string}, @Param() param) {
		console.log(info, param);
		return "成功";
	}
}
