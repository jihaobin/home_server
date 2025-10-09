import { Button } from "@repo/mobile-ui/components/ui/button";
import { alipay, authInfo, setAlipaySandbox } from "native-expo-alipay";
import { Text, View } from "react-native";
import { genericAuthSign } from "@/hooks/api/pay";
import { useCompleteOrder, useVerifyCheckIn } from "@/hooks/api/order";
import useLocation from "@/hooks/useLocation";

async function aliPay() {
	setAlipaySandbox(true);
	const payInfo =
		"method=alipay.trade.app.pay&app_id=9021000153675106&charset=utf-8&version=1.0&sign_type=RSA2&timestamp=2025-09-30%2010%3A36%3A58&notify_url=http%3A%2F%2Fe96a2a8c.natappfree.cc%2Fapi%2Fpay%2Falipay%2Fnotify&biz_content=%7B%22out_trade_no%22%3A%22ORD20250930X91Z8R2I%22%2C%22total_amount%22%3A%2250.00%22%2C%22subject%22%3A%22%E6%B5%8B%E8%AF%95%22%2C%22product_code%22%3A%22QUICK_MSECURITY_PAY%22%2C%22body%22%3A%22%E8%BF%99%E6%98%AF%E6%B5%8B%E8%AF%95%22%7D&sign=ZLZxzfgvVWsw8TmyH%2F%2BgCcTJIQSbd%2BE1l1WTlY8gv6B%2BUBq85%2FGArLXF3TuBJ%2BpWud8c7vCvz1eS7HCSVNnGrXmM%2FW7h24Yo0v44CEXW1rIYfEPtOkNwIcjHtzuHTPl%2Fc%2B0AqBei5xptys%2FLH8s1p0N3WInoE3DtCiS%2FTx2jyoombBhQzOr1pbOGtiY8UwX5OkwLe9iM2UtxEMCzlr%2FX0BgFrRcQ6KitfFoQCAPduEJBBOlHy95uYOnpjlQUNFoc06dK8vjjOcpbjMV%2FEQ%2FBPJDwuzJn2OuZ0yI8AZzQnCPljdb%2Fug1ZMMOUcjpH2DZE2YtbFqkhrRyjfdUYNORoKA%3D%3D";
	await alipay(payInfo);
}

async function aliAuth() {
	const signStr = await genericAuthSign();

	const result = await authInfo(signStr.data);
	console.log(result);
}


export default function PayPage() {
    const {mutate} = useVerifyCheckIn()
    const {location} = useLocation()

    const {mutate: completeOrder} = useCompleteOrder()

	return (
		<View>
			<Button onPress={aliPay}>
				<Text>支付</Text>
			</Button>
			<Button onPress={aliAuth}>
				<Text>授权</Text>
			</Button>
            <Button onPress={() => {
                mutate({
                    token: "fb0f389c595396d1ece62d24027c2626a161acc2f4dc2bb5",
                    orderId: "fspiuan9dfy1t30",
                    latitude: location?.latitude || 0,
                    longitude: location?.longitude || 0,
                })
            }}>
				<Text>上门校验</Text>
			</Button>
            <Button onPress={() => {
                completeOrder("fspiuan9dfy1t30")
            }}>
				<Text>完成订单</Text>
			</Button>
		</View>
	);
}
