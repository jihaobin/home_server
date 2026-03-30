import { SITE_URL } from "@/lib/site";

export const WORKER_SITE_NAME = "叮咚上单";
export const WORKER_SITE_SHORT_NAME = "叮咚上单";
export const WORKER_SITE_TAGLINE = "接单、服务推进、收益管理，一端完成";
export const WORKER_SITE_DESCRIPTION =
    "叮咚上单是面向平台服务人员的独立工作台站点，介绍接单、服务流程、消息提醒、账户与结算等核心能力，并提供 APK 下载与安装说明。";

export const WORKER_SITE_NAV_ITEMS = [
    { href: "/worker-app", label: "首页" },
    { href: "/worker-app/features", label: "功能" },
    { href: "/worker-app/download", label: "下载" },
    { href: "/worker-app/faq", label: "常见问题" },
    { href: "/worker-app/contact", label: "支持" },
] as const;

export const WORKER_VALUE_CARDS = [
    {
        title: "接单更及时",
        desc: "新订单待接单、接单提醒、上门提醒等关键信息集中触达，减少漏单风险。",
    },
    {
        title: "执行更顺畅",
        desc: "从待接单、待服务到服务中、已完成，流程节点清楚，现场推进更有把握。",
    },
    {
        title: "收益更透明",
        desc: "账户余额、本月收益、累计收益与提现状态集中查看，方便日常对账。",
    },
] as const;

export const WORKER_FEATURE_GROUPS = [
    {
        title: "订单大厅",
        items: [
            "按待接单、待服务、服务中、已完成等状态查看订单",
            "快速进入订单详情，掌握时间、地点与客户信息",
            "支持确认接单、拒绝接单、取消订单等关键操作",
        ],
    },
    {
        title: "服务进展",
        items: [
            "查看接单时间、开始服务、完成服务等时间节点",
            "服务中关注现场情况，按流程推进服务",
            "扫码核验等现场动作可在移动端直接完成",
        ],
    },
    {
        title: "消息与聊天",
        items: [
            "新订单待接单、支付超时、上门提醒等消息及时触达",
            "聊天页集中查看订单沟通与最近消息",
            "通知异常时可在端内感知并及时处理",
        ],
    },
    {
        title: "收益与提现",
        items: [
            "查看账户余额、本月收益与累计收益",
            "区分收入与提现记录，跟踪审核与打款状态",
            "支持从移动端直接发起提现申请",
        ],
    },
    {
        title: "服务设置",
        items: [
            "维护已提供服务、服务描述与宣传图片",
            "展示服务优势与适用场景，帮助用户了解能力",
            "按分类管理服务规格与可提供内容",
        ],
    },
    {
        title: "服务区域与资料",
        items: [
            "配置服务区域、服务时间与详细地址",
            "支持实名认证、账号绑定、资料编辑等操作",
            "统一管理个人资料与服务范围，便于长期接单",
        ],
    },
] as const;

export const WORKER_STEPS = [
    {
        step: "01",
        title: "下载安装 APK",
        desc: "进入下载页获取叮咚上单 APK，按手机系统提示完成安装。",
    },
    {
        step: "02",
        title: "登录并开启提醒",
        desc: "登录后建议开启通知、后台运行等必要权限，确保接单提醒正常触达。",
    },
    {
        step: "03",
        title: "开始接单与服务",
        desc: "查看订单列表与订单详情，按待接单、待服务、服务中等流程推进日常工作。",
    },
] as const;

export const WORKER_FAQ_ITEMS = [
    {
        title: "叮咚上单适合谁使用？",
        answer: "叮咚上单面向平台服务人员，用于接单、查看订单进度、管理服务设置、接收消息提醒以及查看收益与提现记录。",
    },
    {
        title: "下载后提示“未知来源应用”，怎么办？",
        answer: "请在 Android 设置中为当前浏览器或文件管理器开启“允许安装未知来源应用”权限，再重新安装 APK。",
    },
    {
        title: "为什么建议开启通知权限？",
        answer: "叮咚上单会接收新订单待接单、接单提醒、上门提醒、订单取消等通知。开启通知后，关键节点更不容易遗漏。",
    },
    {
        title: "这个站点和普通用户下载页有什么区别？",
        answer: "当前子站只介绍叮咚上单相关能力和下载方式；普通用户预约家庭服务请前往主站或用户端下载页。",
    },
    {
        title: "遇到安装或使用问题怎么办？",
        answer: "可以先查看本子站 FAQ 与下载说明；如果仍有问题，请前往支持页面获取联系方式与处理建议。",
    },
] as const;

export const WORKER_SUPPORT_CARDS = [
    {
        title: "下载与安装支持",
        desc: "适合刚开始安装叮咚上单时使用，可查看 APK 直链、安装步骤与系统权限提示。",
        href: "/worker-app/download",
        cta: "查看下载页",
    },
    {
        title: "常见问题",
        desc: "集中整理接单、安装、通知、使用路径等高频问题，适合先自助排查。",
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
