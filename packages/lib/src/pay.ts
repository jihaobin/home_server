import { alipay, type OrderResult, setAlipaySandbox } from "native-expo-alipay";

export type { OrderResult };

export async function aliPay(payInfo: string) {
	setAlipaySandbox(true);
	return await alipay(payInfo);
}
