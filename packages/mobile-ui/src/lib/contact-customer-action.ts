import { Alert } from "react-native";

const CONTACT_WECHAT_ID = "jpq1199";

export function executeContactCustomerAction() {
    Alert.alert(
        "联系小助手",
        `你好呀～为了更快帮你处理问题，请添加微信号：${CONTACT_WECHAT_ID}。\n我们看到消息后会第一时间跟进，感谢理解与配合！`,
        [{ text: "好的" }],
    );
}
