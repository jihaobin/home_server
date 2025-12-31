// 评论图片类型
export interface ReviewImage {
    url: string;
    blurhash?: string;
}

// 评论类型
export interface Review {
    id: string;
    userId: string;
    userName: string;
    avatar?: string;
    avatarFileId?: string;
    rating: number;
    date: string;
    content?: string; // 评论内容
    badge?: string; // VIP、黄金会员等标识
    serviceTag?: string; // 服务标签,如"朱红唇 | 日常保洁"
    location?: string; // 地区
    hasReplied?: boolean; // 是否有回复
    images?: ReviewImage[]; // 评论图片列表
}

// 相似服务类型
export interface SimilarService {
    id: string;
    name: string;
    price: number;
    unit: string;
    image?: string;
    tag?: string;
}

// 工作时间类型
export interface WorkSchedule {
    workDays: string;
    workStartTime: string;
    workEndTime: string;
}

// 服务规格类型
export interface ServiceSpecification {
    id: string;
    userId: string;
    serviceId: string;
    name?: string;
    price: string;
    currency: string;
}
