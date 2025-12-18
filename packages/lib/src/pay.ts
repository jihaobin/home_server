import { alipay, type OrderResult, setAlipaySandbox, authInfo as auth } from "native-expo-alipay";

export type { OrderResult };

export async function aliPay(payInfo: string) {
	setAlipaySandbox(true);
	return await alipay(payInfo);
}

export async function aliAuth(authInfo: string) {
    setAlipaySandbox(false);
    return await auth(authInfo);
}