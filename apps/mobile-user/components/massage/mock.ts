import type { ImageSourcePropType } from "react-native";

export type MassageEntry = {
    id: string;
    label: string;
    textColor: string;
    iconXml: string;
};

export type MassageCoupon = {
    id: string;
    amount: number;
    title: string;
    actionLabel: string;
};

export type MassageCategoryCard = {
    id: string;
    title: string;
    description: string;
    titleColor: string;
    descriptionColor: string;
    gradientFrom: string;
    gradientTo: string;
    imageSource: ImageSourcePropType;
    imageClassName: string;
};

export type MassageProject = {
    id: string;
    name: string;
    description: string;
    price: number;
    badge: string;
    imageSource: ImageSourcePropType;
};

export type MassageAvatarCard = {
    id: string;
    name: string;
    imageSource: ImageSourcePropType;
    serviceId: string;
    pricingId: string;
    serviceName: string;
};

export type MassageMerchant = {
    id: string;
    name: string;
    score: string;
    shopName: string;
    orderSummary: string;
    benefit: string;
    availableTime: string;
    badge: string;
    favoriteCount: string;
    commentCount: string;
    imageSource: ImageSourcePropType;
    serviceId: string;
    pricingId: string;
    serviceName: string;
};

export type MassageDetailRouteParams = {
    id: string;
    serviceId: string;
    pricingId: string;
    serviceName: string;
    personnelName: string;
    mock: "massage";
};

export type MassageDetailMetric = {
    label: string;
    value: string;
};

export type MassageDetailService = {
    id: string;
    name: string;
    tags: readonly string[];
    duration: string;
    price: number;
    originalPrice: number;
    actionLabel: string;
    imageSource: ImageSourcePropType;
    highlightLabel?: string;
};

export type MassageDetailReview = {
    id: string;
    userName: string;
    date: string;
    ratingLabel: string;
    comment: string;
    imageSources: readonly ImageSourcePropType[];
};

export type MassageServicePersonnelDetail = {
    id: string;
    personnelName: string;
    merchantName: string;
    address: string;
    distance: string;
    yearlyOrders: string;
    favoriteCount: string;
    availability: string;
    description: string;
    badges: readonly string[];
    stats: readonly MassageDetailMetric[];
    guaranteeItems: readonly string[];
    reviewScore: string;
    reviewCount: number;
    reviewMetrics: readonly MassageDetailMetric[];
    services: readonly MassageDetailService[];
    reviews: readonly MassageDetailReview[];
    heroImageSource: ImageSourcePropType;
    avatarImageSource: ImageSourcePropType;
};

export function createMassageDetailRouteParams(input: {
    id: string;
    serviceId: string;
    pricingId: string;
    serviceName: string;
    personnelName: string;
}): MassageDetailRouteParams {
    return {
        ...input,
        mock: "massage",
    };
}

const MASSAGE_DETAIL_SERVICE_IMAGES = [
    require("@/assets/images/massage-project.png"),
    require("@/assets/images/promo-1.png"),
    require("@/assets/images/promo-2.png"),
] as const;

const MASSAGE_DETAIL_REVIEW_IMAGES = [
    require("@/assets/images/promo-1.png"),
    require("@/assets/images/promo-2.png"),
    require("@/assets/images/promo-3.png"),
    require("@/assets/images/massage-project.png"),
] as const;

const MASSAGE_DETAIL_BASE = {
    merchantName: "心依健康",
    address: "黄冈市",
    distance: "直线 558m",
    yearlyOrders: "一年 440单",
    favoriteCount: "收藏 428",
    availability: "最早可约今天 16:30",
    description: "我是保健师，擅长中式按摩和精油按摩，欢迎下单",
    badges: ["极速达", "优"] as const,
    stats: [
        { label: "入驻", value: "1年以上" },
        { label: "手法", value: "5" },
        { label: "回头率", value: "高" },
        { label: "满意度", value: "99%" },
    ] as const,
    guaranteeItems: ["契约包退", "实名认证", "资质证书"] as const,
    reviewScore: "5.0",
    reviewCount: 35,
    reviewMetrics: [
        { label: "服务态度", value: "5.0" },
        { label: "技术", value: "5.0" },
        { label: "客户满意度", value: "100%" },
    ] as const,
    services: [
        {
            id: "service-french-spa",
            name: "法式SPA",
            tags: ["保健"] as const,
            duration: "120分钟",
            price: 498,
            originalPrice: 598,
            actionLabel: "去预约",
            imageSource: MASSAGE_DETAIL_SERVICE_IMAGES[0],
        },
        {
            id: "service-thai-spa",
            name: "泰式SPA",
            tags: ["保健"] as const,
            duration: "120分钟",
            price: 358,
            originalPrice: 398,
            actionLabel: "马上抢",
            imageSource: MASSAGE_DETAIL_SERVICE_IMAGES[1],
            highlightLabel: "限时秒杀",
        },
        {
            id: "service-meridian",
            name: "通络拓元",
            tags: ["疏通经络"] as const,
            duration: "80分钟",
            price: 298,
            originalPrice: 398,
            actionLabel: "去预约",
            imageSource: MASSAGE_DETAIL_SERVICE_IMAGES[2],
        },
    ] as const,
    reviews: [
        {
            id: "review-1",
            userName: "用户921893124",
            date: "2023.10.08",
            ratingLabel: "非常满意",
            comment: "打扫的特别仔细！！五星好评！！！",
            imageSources: MASSAGE_DETAIL_REVIEW_IMAGES,
        },
        {
            id: "review-2",
            userName: "用户921893124",
            date: "2023.10.08",
            ratingLabel: "满意",
            comment: "打扫的特别仔细！！五星好评！！！",
            imageSources: MASSAGE_DETAIL_REVIEW_IMAGES,
        },
    ] as const,
} satisfies Omit<
    MassageServicePersonnelDetail,
    "id" | "personnelName" | "heroImageSource" | "avatarImageSource"
>;

export const MASSAGE_DETAIL_THEME = {
    pageBackground: "#f4f5f7",
    pageBackgroundSoft: "#f9fafb",
    heroBackground: "#fff3e0",
    contentGradientStart: "#ffe8c9",
    contentGradientEnd: "#ffffff",
    favoriteButton: "#f7a144",
    statPanelBackground: "#fffaf3",
    statPanelBorder: "#f6d9ac",
    tagBackground: "#fff1de",
    tagForeground: "#c86c14",
    availabilityForeground: "#f06b22",
    separator: "#edf0f3",
    serviceBorder: "#f1f2f4",
    limitedBackground: "#fff2f2",
    limitedBorder: "#ffd8d8",
    limitedLabelBackground: "#ff6c6c",
    reviewTagBackground: "#fff7ea",
    reviewTagForeground: "#c98012",
    star: "#f7bf2a",
} as const;

function createMassageServicePersonnelDetail(input: {
    id: string;
    personnelName: string;
    heroImageSource: ImageSourcePropType;
    avatarImageSource: ImageSourcePropType;
}): MassageServicePersonnelDetail {
    return {
        ...MASSAGE_DETAIL_BASE,
        ...input,
    };
}

export const MASSAGE_SERVICE_PERSONNEL_DETAILS: Record<
    string,
    MassageServicePersonnelDetail
> = {
    "newcomer-1": createMassageServicePersonnelDetail({
        id: "newcomer-1",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-white.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-white.png"),
    }),
    "newcomer-2": createMassageServicePersonnelDetail({
        id: "newcomer-2",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-white.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-white.png"),
    }),
    "instant-1": createMassageServicePersonnelDetail({
        id: "instant-1",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-blue.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-blue.png"),
    }),
    "instant-2": createMassageServicePersonnelDetail({
        id: "instant-2",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-blue.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-blue.png"),
    }),
    "merchant-1": createMassageServicePersonnelDetail({
        id: "merchant-1",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-blue.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-blue.png"),
    }),
    "merchant-2": createMassageServicePersonnelDetail({
        id: "merchant-2",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-blue.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-blue.png"),
    }),
    "merchant-3": createMassageServicePersonnelDetail({
        id: "merchant-3",
        personnelName: "心依",
        heroImageSource: require("@/assets/images/massage-personnel-blue.png"),
        avatarImageSource: require("@/assets/images/massage-personnel-blue.png"),
    }),
};

export function getMassageServicePersonnelDetail(
    personnelId?: string,
): MassageServicePersonnelDetail {
    return (
        (personnelId
            ? MASSAGE_SERVICE_PERSONNEL_DETAILS[personnelId]
            : undefined) ?? MASSAGE_SERVICE_PERSONNEL_DETAILS["merchant-1"]
    );
}

export const MASSAGE_PAGE_MOCK = {
    backgroundColor: "#f4f5f7",
    topBackgroundSource: require("@/assets/images/massage-top-bg.svg"),
    bannerImageSource: require("@/assets/images/massage-banner.png"),
    merchantStatsIconSource: require("@/assets/images/icon-round.png"),
    merchantCommentIconSource: require("@/assets/images/icon-time.png"),
    brandTitle: "叮咚上门",
    brandSubtitle: "严选商户-平台保障  就在叮咚",
    entryBar: {
        leftDecorationSource: require("@/assets/images/massage-entry-left-decoration.svg"),
        rightDecorationSource: require("@/assets/images/massage-entry-right-decoration.svg"),
        entries: [
            {
                id: "merchant-settle",
                label: "商户入驻",
                textColor: "#800000",
                iconXml: `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 29.9991 26.9163" fill="none" xmlns="http://www.w3.org/2000/svg"><g><path d="M4.03822 2.59195H24.2293C24.3913 2.59517 24.5522 2.56381 24.7012 2.49997C24.8502 2.43613 24.9838 2.34126 25.0932 2.2217C25.3226 1.96971 25.4463 1.63919 25.4388 1.29854C25.4476 0.956183 25.3238 0.623671 25.0932 0.370436C24.9836 0.251124 24.8499 0.156429 24.701 0.0926043C24.5521 0.02878 24.3913 -0.00272039 24.2293 0.000184051H4.03822C3.87622 -0.00272039 3.71545 0.02878 3.56653 0.0926043C3.4176 0.156429 3.28391 0.251124 3.1743 0.370436C2.94374 0.623671 2.81994 0.956183 2.82873 1.29854C2.82008 1.46363 2.84482 1.62877 2.90147 1.78408C2.95812 1.93939 3.04552 2.08168 3.15844 2.20243C3.27135 2.32318 3.40747 2.41991 3.55863 2.48684C3.7098 2.55377 3.87291 2.58952 4.03822 2.59195ZM7.10391 11.6261C8.04188 11.3546 8.62441 14.3462 10.3276 14.3709C12.0307 14.3956 12.9341 13.4922 13.9314 11.6952C14.5534 11.0238 14.8446 12.2284 15.1063 12.7418C15.3679 13.2552 16.1924 14.6177 17.7919 14.5486C19.7172 14.4696 19.9443 13.3836 21.0649 11.5866C21.598 11.2657 21.8251 11.8532 22.1559 12.6036C23.0314 12.2882 23.9622 12.1554 24.891 12.2131C25.8197 12.2708 26.7269 12.5179 27.5566 12.9393C28.0153 12.2224 28.2634 11.391 28.2725 10.54L25.7696 3.74714H24.6835H2.42392L0 10.5302C0 12.5591 1.56987 14.5338 3.50999 14.5338C5.45011 14.5338 6.35353 11.8631 7.10391 11.6261Z" fill="#800000"/><path d="M21.4057 25.3994C21.1959 25.1083 20.9542 24.8417 20.6849 24.6046C19.4779 23.7897 18.5645 22.6087 18.0792 21.2356C17.5939 19.8624 17.5625 18.3697 17.9895 16.9774H17.6736C16.8999 16.9645 16.1487 16.7155 15.5205 16.2637C14.8923 15.812 14.4171 15.1791 14.1586 14.4498C13.8922 15.1813 13.4094 15.8144 12.7745 16.265C12.1396 16.7156 11.3827 16.9623 10.6042 16.9724C9.83115 16.9599 9.08035 16.7116 8.45222 16.2608C7.82408 15.81 7.34857 15.1782 7.08928 14.4498C6.76837 15.3656 6.10552 16.1218 5.23957 16.5598C4.37362 16.9978 3.37176 17.0838 2.44385 16.7997V25.1772C2.44385 25.9523 3.25347 26.9001 3.97916 26.9001H22.2844C22.2118 26.7629 22.1523 26.6191 22.1067 26.4706C21.9734 26.2436 21.7216 25.8239 21.4057 25.3944V25.3994Z" fill="#800000"/><path d="M24.4711 13.4428C23.2807 13.4442 22.1225 13.8295 21.1684 14.5414C20.2143 15.2533 19.5152 16.2539 19.1748 17.3946C18.8345 18.5354 18.8711 19.7555 19.2791 20.8738C19.6872 21.9921 20.445 22.949 21.44 23.6025C21.8107 23.9152 22.1422 24.2716 22.4274 24.6639C22.7335 25.0913 23.0169 25.5346 23.2765 25.9919C23.3453 26.2609 23.5033 26.4987 23.7246 26.6665C23.9459 26.8344 24.2175 26.9223 24.4952 26.916C24.7729 26.9097 25.0402 26.8095 25.2537 26.6319C25.4672 26.4542 25.6142 26.2095 25.6708 25.9375C25.8323 25.4461 26.0946 24.9938 26.4409 24.6096C26.806 24.2091 27.2095 23.8454 27.6454 23.5235L27.8281 23.3902L27.9861 23.2865H27.9416L27.991 23.247C28.8689 22.5213 29.5015 21.5423 29.8024 20.4437C30.1033 19.3452 30.0579 18.1805 29.6724 17.1086C29.2869 16.0368 28.58 15.1101 27.6482 14.4549C26.7165 13.7997 25.6053 13.448 24.4662 13.4477L24.4711 13.4428ZM24.4711 21.5488C23.9615 21.5488 23.4632 21.3977 23.0395 21.1145C22.6157 20.8314 22.2854 20.4289 22.0903 19.958C21.8953 19.4871 21.8443 18.969 21.9437 18.4691C22.0431 17.9692 22.2886 17.5101 22.649 17.1497C23.0094 16.7893 23.4685 16.5439 23.9684 16.4444C24.4683 16.345 24.9864 16.396 25.4573 16.5911C25.9282 16.7861 26.3306 17.1164 26.6138 17.5402C26.897 17.964 27.0481 18.4622 27.0481 18.9719C27.0481 19.3103 26.9814 19.6454 26.8519 19.958C26.7224 20.2707 26.5326 20.5548 26.2933 20.794C26.054 21.0333 25.77 21.2232 25.4573 21.3527C25.1447 21.4822 24.8096 21.5488 24.4711 21.5488Z" fill="#800000"/></g></svg>`,
            },
            {
                id: "favorite-merchant",
                label: "收藏商户",
                textColor: "#00306b",
                iconXml: `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 32 25.627" fill="none" xmlns="http://www.w3.org/2000/svg"><g><path d="M5.01539 8.48129C5.36531 7.29825 6.44836 6.46513 7.68139 6.41514H27.2098C27.2098 4.64892 25.7768 3.21595 24.0106 3.21595H11.997L10.7973 1.01651C10.564 0.416664 9.96414 0.0167659 9.3143 0.000103459H3.19919C1.43297 0.0167659 0 1.44974 0 3.21595V20.0117C0 21.2447 0.716485 22.3778 1.84953 22.8943L5.01539 8.48129ZM26.8265 21.478C27.0098 21.1447 27.1431 20.7948 27.2098 20.4283L26.8265 21.478Z" fill="#00306B" fill-opacity="0.77"/><path d="M29.1425 8.01478H9.28087C8.04785 8.04811 6.96479 8.88123 6.61488 10.0809L3.21574 25.627H25.6101C26.8431 25.577 27.9261 24.7439 28.276 23.5608L31.8085 12.3637C32.525 10.2642 31.142 8.01478 29.1425 8.01478ZM22.5608 16.2127L20.5114 18.2289L20.9946 21.0781C21.0445 21.3114 20.9612 21.5447 20.7946 21.6946C20.7113 21.778 20.5947 21.8113 20.478 21.7946C20.3614 21.7946 20.2281 21.7613 20.1281 21.6946L17.5954 20.3617L15.0627 21.7113C14.8628 21.8446 14.5962 21.8446 14.4129 21.7113C14.2296 21.5613 14.1463 21.3281 14.2129 21.0948L14.6962 18.2455L12.6467 16.2127C12.3967 16.0294 12.3301 15.6962 12.5134 15.4462C12.6134 15.2963 12.78 15.213 12.9633 15.213L15.8125 14.7964L17.0956 12.1971C17.1955 11.9138 17.5121 11.7638 17.7954 11.8638C17.9453 11.9138 18.0786 12.0471 18.1286 12.1971L19.4116 14.7964L22.2609 15.213C22.5608 15.213 22.8108 15.4629 22.8108 15.7795C22.8108 15.9461 22.7108 16.1127 22.5608 16.2127Z" fill="#00306B"/></g></svg>`,
            },
        ] satisfies readonly MassageEntry[],
    },
    coupons: [
        { id: "coupon-1", amount: 40, title: "现金券", actionLabel: "去使用" },
        { id: "coupon-2", amount: 40, title: "现金券", actionLabel: "去使用" },
        { id: "coupon-3", amount: 40, title: "现金券", actionLabel: "去使用" },
        { id: "coupon-4", amount: 40, title: "现金券", actionLabel: "去使用" },
    ] satisfies readonly MassageCoupon[],
    categoryCards: [
        {
            id: "health-care",
            title: "保健",
            description: "放松身心\n缓解疲劳",
            titleColor: "#004376",
            descriptionColor: "#5ea6c3",
            gradientFrom: "#e3f7ff",
            gradientTo: "#ffffff",
            imageSource: require("@/assets/images/massage-personnel-blue.png"),
            imageClassName: "h-[92px] w-[54px]",
        },
        {
            id: "conditioning",
            title: "调理",
            description: "放松身心\n缓解疲劳",
            titleColor: "#6e4600",
            descriptionColor: "#c99947",
            gradientFrom: "#fffce4",
            gradientTo: "#ffffff",
            imageSource: require("@/assets/images/massage-personnel-white.png"),
            imageClassName: "h-[96px] w-[58px]",
        },
    ] satisfies readonly MassageCategoryCard[],
    projects: [
        {
            id: "project-1",
            name: "中式推拿",
            description: "放松身心 缓解疲劳",
            price: 208,
            badge: "新人特惠",
            imageSource: require("@/assets/images/massage-project.png"),
        },
        {
            id: "project-2",
            name: "中式推拿",
            description: "放松身心 缓解疲劳",
            price: 208,
            badge: "新人特惠",
            imageSource: require("@/assets/images/massage-project.png"),
        },
    ] satisfies readonly MassageProject[],
    newcomerColumns: [
        {
            id: "newcomer",
            title: "新人上线",
            cards: [
                {
                    id: "newcomer-1",
                    name: "张菲菲",
                    imageSource: require("@/assets/images/massage-personnel-white.png"),
                    serviceId: "service-french-spa",
                    pricingId: "pricing-french-spa",
                    serviceName: "法式SPA",
                },
                {
                    id: "newcomer-2",
                    name: "梅丽华",
                    imageSource: require("@/assets/images/massage-personnel-white.png"),
                    serviceId: "service-thai-spa",
                    pricingId: "pricing-thai-spa",
                    serviceName: "泰式SPA",
                },
            ] satisfies readonly MassageAvatarCard[],
        },
        {
            id: "instant",
            title: "极速达",
            cards: [
                {
                    id: "instant-1",
                    name: "张菲菲",
                    imageSource: require("@/assets/images/massage-personnel-white.png"),
                    serviceId: "service-thai-spa",
                    pricingId: "pricing-thai-spa",
                    serviceName: "泰式SPA",
                },
                {
                    id: "instant-2",
                    name: "梅丽华",
                    imageSource: require("@/assets/images/massage-personnel-white.png"),
                    serviceId: "service-meridian",
                    pricingId: "pricing-meridian",
                    serviceName: "通络拓元",
                },
            ] satisfies readonly MassageAvatarCard[],
        },
    ] as const,
    merchants: [
        {
            id: "merchant-1",
            name: "李兴兰",
            score: "5.0分",
            shopName: "心依健康",
            orderSummary: "一年440单",
            benefit: "免出行费",
            availableTime: "最早可约12:00",
            badge: "极速达",
            favoriteCount: "223",
            commentCount: "577",
            imageSource: require("@/assets/images/massage-personnel-blue.png"),
            serviceId: "service-french-spa",
            pricingId: "pricing-french-spa",
            serviceName: "法式SPA",
        },
        {
            id: "merchant-2",
            name: "李兴兰",
            score: "5.0分",
            shopName: "心依健康",
            orderSummary: "一年440单",
            benefit: "免出行费",
            availableTime: "最早可约12:00",
            badge: "极速达",
            favoriteCount: "223",
            commentCount: "577",
            imageSource: require("@/assets/images/massage-personnel-blue.png"),
            serviceId: "service-thai-spa",
            pricingId: "pricing-thai-spa",
            serviceName: "泰式SPA",
        },
        {
            id: "merchant-3",
            name: "李兴兰",
            score: "5.0分",
            shopName: "心依健康",
            orderSummary: "一年440单",
            benefit: "免出行费",
            availableTime: "最早可约12:00",
            badge: "极速达",
            favoriteCount: "223",
            commentCount: "577",
            imageSource: require("@/assets/images/massage-personnel-blue.png"),
            serviceId: "service-meridian",
            pricingId: "pricing-meridian",
            serviceName: "通络拓元",
        },
    ] satisfies readonly MassageMerchant[],
} as const;
