import { NativeModules, Platform } from "react-native";

type JVerificationModule = {
    init: (
        params: {
            time?: number;
            appkey?: string;
            channel?: string;
            advertisingId?: string;
            isProduction?: boolean;
        },
        callback: (result: JVerificationResult) => void,
    ) => void;
    checkLoginEnable: (
        strictMode: boolean,
        callback: (result: { enable?: boolean }) => void,
    ) => void;
    getToken: (
        timeout: number,
        callback: (result: JVerificationResult) => void,
    ) => void;
    login: (
        autoDismiss: boolean,
        timeout: number,
        callback: (result: JVerificationResult) => void,
    ) => void;
    dismissLoginPage?: () => void;
    addLoginCustomConfig?: (
        customConfigParams: {
            customWidgetList?: Record<string, unknown>[];
            [key: string]: unknown;
        },
        customViewParams?: unknown,
    ) => void;
    addClikWidgetEventListener?: (
        callback: (result: { eventId?: string }) => void,
    ) => void;
    removeListener?: (callback: (result: { eventId?: string }) => void) => void;
    JVCustomWidget?: new (
        widgetId: string,
        type: "textView" | "button",
    ) => {
        title?: string;
        left?: number;
        top?: number;
        width?: number;
        height?: number;
        titleFont?: number;
        titleColor?: number;
        backgroundColor?: number;
        btnNormalImageName?: string;
        btnPressedImageName?: string;
        textAlignment?: "left" | "right" | "center";
        isClickEnable?: boolean;
        toJsonMap: () => Record<string, unknown>;
    };
};

type JVerificationCustomWidget = InstanceType<
    NonNullable<JVerificationModule["JVCustomWidget"]>
>;

type JVerificationResult = {
    code?: number;
    content?: string;
};

export type JVerificationAuthApp = "mobile-user" | "mobile-worker";
export type JVerificationAuthPlatform = "android" | "ios";

export type JVerificationOneClickLoginOptions = {
    app: JVerificationAuthApp;
    appKey?: string;
    channel?: string;
    isProduction?: boolean;
    pageTitle?: string;
    authBaseUrl: string;
    authClient?: {
        $fetch?: (path: string, options: Record<string, unknown>) => unknown;
        getSession?: () => Promise<unknown>;
    };
    onSwitchToOtp?: () => void;
};

type AuthPageTheme = {
    productName: string;
    accentColor: number;
    backgroundColor: number;
    buttonImageSelector: string;
    buttonPressedImage: string;
    buttonNormalImage: string;
    socialWechatImage: string;
    socialWechatPressedImage: string;
    socialQqImage: string;
    socialQqPressedImage: string;
};

type LoginResponse = {
    status: boolean;
    token: string | null;
    user?: unknown;
};

type ErrorResponse = {
    message?: string;
};

class JVerificationOtpSwitchError extends Error {
    constructor() {
        super("已切换验证码登录");
        this.name = "JVerificationOtpSwitchError";
    }
}

export class JVerificationAuthPageClosedError extends Error {
    code?: number;

    constructor(result: JVerificationResult) {
        super(result.content || "授权页面已关闭");
        this.name = "JVerificationAuthPageClosedError";
        this.code = result.code;
    }
}

const OTP_SWITCH_WIDGET_ID = "otp_login_switch";
const TERMS_URL = "https://dingsm.com/terms";
const PRIVACY_URL = "https://dingsm.com/privacy";
const TEXT_COLOR_MUTED = -9735552; // #6B7280
const TEXT_COLOR_LIGHT = -7760984; // #8993A8
const WHITE_COLOR = -1;
const AUTH_PAGE_THEMES: Record<JVerificationAuthApp, AuthPageTheme> = {
    "mobile-user": {
        productName: "叮咚上门",
        accentColor: -551653, // #F7951B
        backgroundColor: -1, // #FFFFFF
        buttonImageSelector: "jverification_login_btn_user",
        buttonNormalImage: "jverification_login_btn_user_normal",
        buttonPressedImage: "jverification_login_btn_user_pressed",
        socialWechatImage: "jverification_social_wechat",
        socialWechatPressedImage: "jverification_social_wechat_pressed",
        socialQqImage: "jverification_social_qq",
        socialQqPressedImage: "jverification_social_qq_pressed",
    },
    "mobile-worker": {
        productName: "叮咚上单",
        accentColor: -14836752, // #1D9BF0
        backgroundColor: -1, // #FFFFFF
        buttonImageSelector: "jverification_login_btn_worker",
        buttonNormalImage: "jverification_login_btn_worker_normal",
        buttonPressedImage: "jverification_login_btn_worker_pressed",
        socialWechatImage: "jverification_social_wechat",
        socialWechatPressedImage: "jverification_social_wechat_pressed",
        socialQqImage: "jverification_social_qq",
        socialQqPressedImage: "jverification_social_qq_pressed",
    },
};

let cachedModule: JVerificationModule | null | undefined;
let initPromise: Promise<void> | null = null;

declare const require: (moduleName: string) => {
    default?: JVerificationModule;
} & JVerificationModule;

function getJVerificationModule(): JVerificationModule | null {
    if (cachedModule !== undefined) {
        return cachedModule;
    }

    if (!(NativeModules as Record<string, unknown>).JVerificationModule) {
        cachedModule = null;
        return cachedModule;
    }

    try {
        const module = require("jverification-react-native");
        cachedModule = module.default ?? module;
    } catch {
        cachedModule = null;
    }

    return cachedModule;
}

function getPlatform(): JVerificationAuthPlatform {
    return Platform.OS === "ios" ? "ios" : "android";
}

function resolveContent(result: JVerificationResult, successCode: number) {
    if (result.code !== successCode || !result.content) {
        throw new Error(result.content || "当前环境暂不支持一键登录");
    }

    return result.content;
}

async function callJVerification<T>(
    action: (
        module: JVerificationModule,
        resolve: (value: T) => void,
        reject: (error: Error) => void,
    ) => void,
) {
    const module = getJVerificationModule();
    if (!module) {
        return Promise.reject(new Error("当前安装包不支持一键登录"));
    }

    return new Promise<T>((resolve, reject) => {
        try {
            action(module, resolve, reject);
        } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

function setupOtpSwitchButton(
    module: JVerificationModule,
    theme: AuthPageTheme,
    onSwitchToOtp?: () => void,
    onSwitchClicked?: () => void,
) {
    if (!module.addLoginCustomConfig) {
        return undefined;
    }

    const JVCustomWidget = module.JVCustomWidget;
    const addClickWidgetEventListener = module.addClikWidgetEventListener;
    const supportsCustomWidgets =
        onSwitchToOtp && JVCustomWidget && addClickWidgetEventListener;

    const customWidgetList: Record<string, unknown>[] = [];
    let switchButton: JVerificationCustomWidget | undefined;

    if (supportsCustomWidgets && JVCustomWidget) {
        const brand = new JVCustomWidget("login_page_brand", "textView");
        brand.title = theme.productName;
        brand.left = 32;
        brand.top = 224;
        brand.width = 296;
        brand.height = 32;
        brand.titleFont = 24;
        brand.textAlignment = "center";

        switchButton = new JVCustomWidget(OTP_SWITCH_WIDGET_ID, "button");
        switchButton.title = "手机验证码登录";
        switchButton.left = 32;
        switchButton.top = 392;
        switchButton.width = 296;
        switchButton.height = 44;
        switchButton.titleFont = 15;
        switchButton.titleColor = theme.accentColor;
        switchButton.backgroundColor = 0;
        switchButton.textAlignment = "center";
        switchButton.isClickEnable = true;

        const otherLogin = new JVCustomWidget(
            "login_page_other_login",
            "textView",
        );
        otherLogin.title = "其他方式登录";
        otherLogin.left = 138;
        otherLogin.top = 486;
        otherLogin.width = 84;
        otherLogin.height = 18;
        otherLogin.titleFont = 12;
        otherLogin.titleColor = TEXT_COLOR_LIGHT;
        otherLogin.textAlignment = "center";

        const wechat = new JVCustomWidget("login_page_wechat", "button");
        wechat.title = "";
        wechat.left = 102;
        wechat.top = 520;
        wechat.width = 44;
        wechat.height = 44;
        wechat.btnNormalImageName = theme.socialWechatImage;
        wechat.btnPressedImageName = theme.socialWechatPressedImage;
        wechat.isClickEnable = false;

        const wechatLabel = new JVCustomWidget(
            "login_page_wechat_label",
            "textView",
        );
        wechatLabel.title = "微信";
        wechatLabel.left = 90;
        wechatLabel.top = 566;
        wechatLabel.width = 68;
        wechatLabel.height = 18;
        wechatLabel.titleFont = 12;
        wechatLabel.titleColor = TEXT_COLOR_LIGHT;
        wechatLabel.textAlignment = "center";

        const qq = new JVCustomWidget("login_page_qq", "button");
        qq.title = "";
        qq.left = 208;
        qq.top = 520;
        qq.width = 44;
        qq.height = 44;
        qq.btnNormalImageName = theme.socialQqImage;
        qq.btnPressedImageName = theme.socialQqPressedImage;
        qq.isClickEnable = false;

        const qqLabel = new JVCustomWidget("login_page_qq_label", "textView");
        qqLabel.title = "QQ";
        qqLabel.left = 196;
        qqLabel.top = 566;
        qqLabel.width = 68;
        qqLabel.height = 18;
        qqLabel.titleFont = 12;
        qqLabel.titleColor = TEXT_COLOR_LIGHT;
        qqLabel.textAlignment = "center";

        customWidgetList.push(
            brand.toJsonMap(),
            switchButton.toJsonMap(),
            otherLogin.toJsonMap(),
            wechat.toJsonMap(),
            wechatLabel.toJsonMap(),
            qq.toJsonMap(),
            qqLabel.toJsonMap(),
        );
    }

    module.addLoginCustomConfig({
        navTitle: theme.productName,
        navHidden: true,
        navReturnHidden: true,
        navTransparent: true,
        statusBarTransparent: true,
        statusBarMode: "dark",
        backgroundColor: theme.backgroundColor,
        logoHidden: false,
        logoX: 132,
        logoY: 100,
        logoW: 96,
        logoH: 96,
        numberX: 32,
        numberY: 270,
        numberW: 296,
        numberH: 28,
        numberSize: 16,
        numberColor: theme.accentColor,
        sloganHidden: true,
        sloganY: 356,
        sloganW: 1,
        sloganH: 1,
        sloganTextSize: 13,
        sloganTextColor: TEXT_COLOR_LIGHT,
        loginBtnText: "一键登录",
        loginBtnTextSize: 16,
        loginBtnTextColor: WHITE_COLOR,
        loginBtnImageSelector: theme.buttonImageSelector,
        loginBtnImage: theme.buttonImageSelector,
        loginBtnNormalImage: theme.buttonNormalImage,
        loginBtnSelectedImage: theme.buttonPressedImage,
        loginBtnDisabledImage: theme.buttonNormalImage,
        loginBtnOffsetX: 32,
        loginBtnOffsetY: 322,
        loginBtnWidth: 296,
        loginBtnHeight: 48,
        loginBtnX: 32,
        loginBtnY: 322,
        loginBtnW: 296,
        loginBtnH: 48,
        logBtnTextBold: true,
        privacyColor: [TEXT_COLOR_MUTED, theme.accentColor],
        privacyText: ["我已阅读并同意", "、", "和", ""],
        privacyNameAndUrlBeanList: [
            { name: "用户协议", url: TERMS_URL, separator: "、" },
            { name: "隐私政策", url: PRIVACY_URL, separator: "" },
        ],
        privacyTextSize: 12,
        privacyTextGravityMode: "left",
        privacyBookSymbolEnable: true,
        privacyCheckboxOffsetX: 0,
        privacyCheckboxOffsetY: 2,
        privacyOffsetX: 46,
        privacyOffsetY: 148,
        privacyX: 46,
        privacyY: 148,
        privacyW: 268,
        privacyH: 48,
        privacyCheckboxSize: 14,
        privacyCheckboxInCenter: false,
        privacyCheckEnable: false,
        enablePrivacyCheckDialog: true,
        isAlertPrivacyVC: true,
        setPrivacyCheckDialogBackgroundColor: WHITE_COLOR,
        setPrivacyCheckDialogTitleText: "同意并继续",
        setPrivacyCheckDialogTitleTextSize: 18,
        setPrivacyCheckDialogTitleTextColor: theme.accentColor,
        setPrivacyCheckDialogContentTextGravity: "left",
        setPrivacyCheckDialogContentTextSize: 13,
        setPrivacyCheckDialogContentTextPaddingL: 16,
        setPrivacyCheckDialogContentTextPaddingT: 12,
        setPrivacyCheckDialogContentTextPaddingR: 16,
        setPrivacyCheckDialogContentTextPaddingB: 8,
        setPrivacyCheckDialogLogBtnImgPath: theme.buttonImageSelector,
        setPrivacyCheckDialoglogBtnTextColor: WHITE_COLOR,
        setPrivacyCheckDialogWidth: -1,
        setPrivacyCheckDialogLogBtnMarginL: 0,
        setPrivacyCheckDialogLogBtnMarginR: 0,
        setPrivacyCheckDialogLogBtnWidth: -1,
        setPrivacyCheckDialogLogBtnHeight: 48,
        setPrivacyCheckDialogLogBtnText: "同意并登录",
        privacyWebNavColor: theme.accentColor,
        privacyWebNavTitle: "隐私政策",
        privacyWebNavTitleSize: 16,
        privacyWebNavTitleColor: WHITE_COLOR,
        customWidgetList,
    });

    if (
        !supportsCustomWidgets ||
        !addClickWidgetEventListener ||
        !onSwitchToOtp
    ) {
        return undefined;
    }

    let clicked = false;
    const listener = (result: { eventId?: string }) => {
        if (result.eventId !== OTP_SWITCH_WIDGET_ID) {
            return;
        }
        clicked = true;
        module.dismissLoginPage?.();
        onSwitchToOtp();
        module.removeListener?.(listener);
        onSwitchClicked?.();
    };

    addClickWidgetEventListener(listener);

    return {
        wasClicked: () => clicked,
        remove: () => module.removeListener?.(listener),
    };
}

export function dismissLoginPage() {
    callJVerification<void>((module, resolve, reject) => {
        module.dismissLoginPage?.();
        resolve();
    });
}

export async function initJVerification(
    options: JVerificationOneClickLoginOptions,
) {
    if (initPromise) {
        return initPromise;
    }

    initPromise = callJVerification<void>((module, resolve, reject) => {
        module.init(
            {
                time: 10000,
                appkey: options.appKey,
                channel: options.channel,
                isProduction: options.isProduction ?? false,
            },
            (result) => {
                if (result.code === 8000 || Platform.OS === "android") {
                    resolve();
                    return;
                }
                reject(new Error(result.content || "一键登录初始化失败"));
            },
        );
    }).catch((error) => {
        initPromise = null;
        throw error;
    });

    return initPromise;
}

export async function checkOneClickLoginAvailable(
    options?: JVerificationOneClickLoginOptions,
) {
    try {
        if (options) {
            await initJVerification(options);
        }
        return await callJVerification<boolean>((module, resolve) => {
            module.checkLoginEnable(true, (result) => {
                resolve(Boolean(result.enable));
            });
        });
    } catch (error) {
        console.warn("Failed to check one-click login availability:", error);
        return false;
    }
}

export async function getOneClickLoginToken(
    timeout = 5000,
    onSwitchToOtp?: () => void,
    theme: AuthPageTheme = AUTH_PAGE_THEMES["mobile-user"],
) {
    return callJVerification<string>((module, resolve, reject) => {
        const otpSwitchButton = setupOtpSwitchButton(
            module,
            theme,
            onSwitchToOtp,
            () => {
                reject(new JVerificationOtpSwitchError());
            },
        );
        module.login(true, timeout, (result) => {
            otpSwitchButton?.remove();
            if (otpSwitchButton?.wasClicked()) {
                reject(new JVerificationOtpSwitchError());
                return;
            }
            if (result.code !== 6000) {
                reject(new JVerificationAuthPageClosedError(result));
                return;
            }
            try {
                resolve(resolveContent(result, 6000));
            } catch (error) {
                reject(
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        });
    });
}

export async function loginWithJVerificationOneClick(
    options: JVerificationOneClickLoginOptions,
) {
    await initJVerification(options);
    const theme = {
        ...AUTH_PAGE_THEMES[options.app],
        productName:
            options.pageTitle ?? AUTH_PAGE_THEMES[options.app].productName,
    };
    const loginToken = await getOneClickLoginToken(
        5000,
        options.onSwitchToOtp,
        theme,
    );

    const requestBody = {
        loginToken,
        app: options.app,
        platform: getPlatform(),
        exId: `${options.app}-${Date.now()}`,
    };

    if (options.authClient?.$fetch) {
        const response = await options.authClient.$fetch(
            "/jverification/login",
            {
                method: "POST",
                body: requestBody,
            },
        );
        await options.authClient.getSession?.();
        return response as LoginResponse;
    }

    const response = await fetch(
        new URL(
            "/api/auth/jverification/login",
            options.authBaseUrl,
        ).toString(),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        },
    );
    const data = (await response.json().catch(() => null)) as
        | LoginResponse
        | ErrorResponse
        | null;

    if (!response.ok || !data || !("status" in data)) {
        const message = data && "message" in data ? data.message : undefined;
        throw new Error(message || "一键登录失败，请使用验证码登录");
    }

    await options.authClient?.getSession?.();
    return data;
}
