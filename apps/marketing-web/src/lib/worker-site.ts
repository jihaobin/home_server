import { SITE_URL } from "@/lib/site";

export const WORKER_SITE_NAME = "叮咚上单";
export const WORKER_SITE_SHORT_NAME = "叮咚上单";
export const WORKER_SITE_TAGLINE = "好接单、好服务、好结算，让每一份技能更值钱";
export const WORKER_SITE_DESCRIPTION =
    "叮咚上单是叮咚上门面向服务人员的专属工作台，帮助你更快接到附近订单、更稳推进上门服务，并清晰管理收入与结算。";

export const WORKER_SITE_NAV_ITEMS = [
    { href: "/worker-app", label: "首页" },
    { href: "/worker-app/features", label: "功能" },
    { href: "/worker-app/download", label: "下载" },
    { href: "/worker-app/faq", label: "常见问题" },
    { href: "/worker-app/contact", label: "支持" },
] as const;

export const WORKER_VALUE_CARDS = [
    {
        title: "订单机会更集中",
        desc: "从新订单提醒到上门通知，关键机会第一时间触达，减少漏单，提升接单效率。",
    },
    {
        title: "服务过程更省心",
        desc: "订单状态、上门节奏、现场推进一目了然，让你把更多精力放在服务体验本身。",
    },
    {
        title: "收入结算更安心",
        desc: "余额、月收益、累计收入与提现进度集中可见，做服务也能把账算得更明白。",
    },
] as const;

export const WORKER_FEATURE_GROUPS = [
    {
        title: "订单大厅",
        items: [
            "按待接单、待服务、服务中、已完成等状态快速筛选订单",
            "一页掌握上门时间、服务地点与客户关键信息",
            "支持接单、拒单、取消等关键动作，处理更高效",
        ],
    },
    {
        title: "服务进展",
        items: [
            "清晰查看接单、出发、服务完成等关键节点",
            "按流程推进现场服务，减少沟通与执行遗漏",
            "扫码核验等现场动作可在移动端直接完成",
        ],
    },
    {
        title: "消息与聊天",
        items: [
            "新订单、支付超时、上门提醒等消息及时触达",
            "聊天页集中处理订单沟通，回复客户更顺手",
            "通知异常可及时感知，避免影响接单节奏",
        ],
    },
    {
        title: "收益与提现",
        items: [
            "随时查看账户余额、本月收益与累计收益",
            "收入、提现记录分开展示，对账更清楚",
            "支持移动端直接发起提现申请，回款进度更透明",
        ],
    },
    {
        title: "服务设置",
        items: [
            "维护已提供服务、服务描述与宣传图片",
            "突出服务优势与适用场景，帮助客户更快下决策",
            "按分类管理服务规格与可提供内容，展示更专业",
        ],
    },
    {
        title: "服务区域与资料",
        items: [
            "配置服务区域、服务时间与详细地址，覆盖范围更清晰",
            "支持实名认证、账号绑定、资料编辑等操作",
            "统一管理个人资料与服务范围，利于稳定长期接单",
        ],
    },
] as const;

export const WORKER_STEPS = [
    {
        step: "01",
        title: "下载安装 APK",
        desc: "进入下载页获取叮咚上单 APK，几分钟内完成安装，准备开始接单。",
    },
    {
        step: "02",
        title: "登录并开启提醒",
        desc: "登录后开启通知和后台运行权限，确保订单机会与上门提醒第一时间送达。",
    },
    {
        step: "03",
        title: "开始接单与服务",
        desc: "进入订单列表立即开始接单，按服务流程稳定推进，把技能快速变成收入。",
    },
] as const;

export const WORKER_FAQ_ITEMS = [
    {
        title: "叮咚上单适合谁使用？",
        answer: "叮咚上单面向入驻叮咚上门平台的服务人员，适合需要稳定接单、管理服务流程、展示个人服务能力并清晰查看收入结算的人群。",
    },
    {
        title: "下载后提示“未知来源应用”，怎么办？",
        answer: "请在 Android 设置中为当前浏览器或文件管理器开启“允许安装未知来源应用”权限，再重新安装 APK。",
    },
    {
        title: "为什么建议开启通知权限？",
        answer: "叮咚上单会接收新订单待接单、接单提醒、上门提醒、订单取消等通知。开启通知后，订单机会和关键节点更不容易错过。",
    },
    {
        title: "这个站点和普通用户下载页有什么区别？",
        answer: "当前子站只介绍叮咚上单相关能力和下载方式；普通用户预约家庭服务请前往主站或用户端下载页。",
    },
    {
        title: "遇到安装或使用问题怎么办？",
        answer: "可以先查看本子站 FAQ 与下载说明；如果仍有问题，请前往支持页面联系平台客服，尽快恢复安装或接单流程。",
    },
] as const;

export const WORKER_SUPPORT_CARDS = [
    {
        title: "下载与安装支持",
        desc: "适合准备开始接单时使用，可快速获取 APK、安装步骤与关键权限提示。",
        href: "/worker-app/download",
        cta: "查看下载页",
    },
    {
        title: "常见问题",
        desc: "集中整理安装、通知、接单流程等高频问题，适合先自助排查、快速上手。",
        href: "/worker-app/faq",
        cta: "查看 FAQ",
    },
    {
        title: "返回主站",
        desc: "如果你是普通用户，需要预约家庭服务，可返回叮咚上门主站查看用户端介绍与下载入口。",
        href: "/",
        cta: "前往主站",
    },
] as const;

export function absoluteWorkerUrl(pathname = "") {
    const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${SITE_URL}/worker-app${suffix === "/" ? "" : suffix}`;
}
