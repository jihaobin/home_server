import {
    alipay,
    type OrderResult,
    setAlipaySandbox,
    authInfo as auth,
} from "native-expo-alipay";

export type { OrderResult };

export type WechatPayRequest = {
    appId: string;
    partnerId: string;
    prepayId: string;
    packageValue: string;
    nonceStr: string;
    timeStamp: string;
    sign: string;
};

export type WechatPayResult = {
    prepayId?: string;
    returnKey?: string;
    extraInfo?: string;
    errorCode: number;
    errorMessage: string;
    openId: string;
    transaction: string;
};

type ExpoWeChatModule = typeof import("expo-wechat");

type ExpoWeChatLike = {
    isRegistered?: boolean | (() => boolean);
    registerApp: (appId: string, universalLink: string) => Promise<boolean>;
    isWXAppInstalled: () => Promise<boolean>;
    pay: (options: {
        partnerId: string;
        prepayId: string;
        nonceStr: string;
        timeStamp: number;
        sign: string;
        package: string;
        extraData: string;
    }) => Promise<boolean>;
};

let expoWeChatModulePromise: Promise<ExpoWeChatModule> | null = null;

async function getExpoWeChat() {
    expoWeChatModulePromise ??= import("expo-wechat");
    const loadedModule = await expoWeChatModulePromise;
    const resolvedModule =
        "default" in loadedModule && loadedModule.default
            ? loadedModule.default
            : loadedModule;

    return resolvedModule as ExpoWeChatLike;
}

function isWeChatRegistered(module: ExpoWeChatLike) {
    if (typeof module.isRegistered === "function") {
        return module.isRegistered();
    }

    return Boolean(module.isRegistered);
}

export async function aliPay(payInfo: string) {
    setAlipaySandbox(false);
    return await alipay(payInfo);
}

export async function aliAuth(authInfo: string) {
    setAlipaySandbox(false);
    return await auth(authInfo);
}

export async function ensureWeChatAppRegistered({
    appId,
    universalLink,
}: {
    appId: string;
    universalLink: string;
}) {
    if (!appId?.trim()) {
        throw new Error("微信 AppID 缺失，请检查移动端环境变量配置");
    }

    // if (!universalLink?.trim()) {
    //     throw new Error("微信 Universal Link 缺失，请检查移动端环境变量配置");
    // }

    const ExpoWeChat = await getExpoWeChat();

    if (isWeChatRegistered(ExpoWeChat)) {
        return true;
    }

    return await ExpoWeChat.registerApp(appId, universalLink);
}

export async function isWeChatAppInstalled() {
    const ExpoWeChat = await getExpoWeChat();
    return await ExpoWeChat.isWXAppInstalled();
}

export async function wechatPay(payInfo: WechatPayRequest) {
    const ExpoWeChat = await getExpoWeChat();
    return await ExpoWeChat.pay({
        partnerId: payInfo.partnerId,
        prepayId: payInfo.prepayId,
        nonceStr: payInfo.nonceStr,
        timeStamp: Number(payInfo.timeStamp),
        sign: payInfo.sign,
        package: payInfo.packageValue,
        extraData: payInfo.prepayId,
    });
}
