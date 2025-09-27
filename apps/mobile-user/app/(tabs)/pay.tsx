import { Button } from "@repo/mobile-ui/components/ui/button";
import { alipay, authInfo, setAlipaySandbox } from "native-expo-alipay";
import { Text, View } from "react-native";
import { genericAuthSign } from "@/hooks/api/pay";

async function aliPay() {
	setAlipaySandbox(true);
	const payInfo =
		"method=alipay.trade.app.pay&app_id=9021000153675106&charset=utf-8&version=1.0&sign_type=RSA2&timestamp=2025-09-27%2018%3A05%3A49&notify_url=http%3A%2F%2Fe96a2a8c.natappfree.cc%2Fapi%2Fpay%2Falipay%2Fnotify&biz_content=%7B%22out_trade_no%22%3A%22ORD20250927KYGJFYAC%22%2C%22total_amount%22%3A%2250.00%22%2C%22subject%22%3A%22%E6%B5%8B%E8%AF%95%22%2C%22product_code%22%3A%22QUICK_MSECURITY_PAY%22%2C%22body%22%3A%22%E8%BF%99%E6%98%AF%E6%B5%8B%E8%AF%95%22%7D&sign=J1EEc%2F6BRHXq3TBg7uHA375iUsQ8D71HkR3nryRtpqdThCxkii2aEMlfs6%2FSIrARjzL9NfrWhLaIaov8DLW%2BNH%2BfSBj2rB1N13KhVB4g54Tg1cvntOqDCZQ6x9geJ2Bqe6T5elYujPwgFezMkXe0nciywJ9YeIdD7H9pBCd4AH964X9j0DwmwqmrCPIJm5RH9DyxVZTbF56otXJKsNc8NR0tKkzHEFVu6QM1h7fmWHpR1GOOBB7DGwK2fH98OcnY9dWEMepiGEmbxNtqJZ07fcrm%2BThG8MRknuj7WZV61b3RLnWnfSR4VdaBRL3GXxTWns7D2iUpO5dK6b0o3csoMA%3D%3D";
	await alipay(payInfo);
}

async function aliAuth() {
	const signStr = await genericAuthSign();

	const result = await authInfo(signStr.data);
	console.log(result);
}

export default function PayPage() {
	return (
		<View>
			<Button onPress={aliPay}>
				<Text>支付</Text>
			</Button>
			<Button onPress={aliAuth}>
				<Text>授权</Text>
			</Button>
		</View>
	);
}
