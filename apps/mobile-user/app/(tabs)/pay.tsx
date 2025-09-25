import { genericAuthSign } from "@/hooks/api/pay";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { alipay, authInfo, setAlipaySandbox } from "native-expo-alipay";

import { Text, View } from "react-native";

async function aliPay() {
    setAlipaySandbox(true);
    const payInfo =
        "method=alipay.trade.app.pay&app_id=9021000153675106&charset=utf-8&version=1.0&sign_type=RSA2&timestamp=2025-09-20%2016%3A06%3A11&notify_url=%20http%3A%2F%2Fsfc9d8c6.natappfree.cc%2Fapi%2Fpay%2Fnotify&biz_content=%7B%22out_trade_no%22%3A%22asdpouarivobsfdgoprutdsf%22%2C%22product_code%22%3A%22234dvbxvpugiouretpufgsp%22%2C%22subject%22%3A%22abc%22%2C%22body%22%3A%22234%22%2C%22total_amount%22%3A%220.01%22%7D&sign=qUM5nYK47wPycBRtGNdnvSxmgbMc%2Bs0IoSUGBbBJl5NLWUagxnsudhck6LyNQ0G%2FppWo%2BZ%2BuUpI%2FcVwEVEZygOvMd3VxYgCoCiMNuP8oJ9iEQKiJ%2FXfhKWOEu7n7X1PrJOrm9hao2Byrueb6jeoPC17IqGKmjDPpleipBZMZ6j5pf7unWivFQw%2B54HbafUA7S5Xt3bgOdUqNVXaE9OiEo8u0QSgCCItgQhwVpPZ1j1L%2BqaH6ZjOfop5n5S%2FeZARPgji9gci7L9UO%2BxpkysnuT4OfXZKbFSQfJdPk2a8gJllPOI9qBGtwbcODqS%2BYz6SOSZE7bphH%2FU%2FJNtpbgImzfQ%3D%3D";
    await alipay(payInfo);
}

async function aliAuth() {
    const signStr = await genericAuthSign()

    const result = await authInfo(signStr.data);
    console.log(result)
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
