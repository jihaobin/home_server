import { z } from "zod/v4";

const ChatTextContentSchema = z
    .object({
        type: z.literal("text"),
        text: z
            .string()
            .min(1, "消息内容不能为空")
            .max(2000, "消息内容不能超过2000字符"),
    })
    .meta({
        title: "私聊文本消息",
        description: "私聊消息内容（文本）",
    });

const ChatImageContentSchema = z
    .object({
        type: z.literal("image"),
        fileId: z.string().min(1).max(255).meta({
            title: "文件 ID",
            description: "files 模块返回的 fileId（或兼容 fileHash）",
        }),
        blurhash: z.string().min(1).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
    })
    .meta({
        title: "私聊图片消息",
        description: "私聊消息内容（图片）",
    });

const ChatVideoContentSchema = z
    .object({
        type: z.literal("video"),
        fileId: z.string().min(1).max(255).meta({
            title: "文件 ID",
            description: "files 模块返回的 fileId（或兼容 fileHash）",
        }),
        durationMs: z.number().int().positive().optional(),
    })
    .meta({
        title: "私聊视频消息",
        description: "私聊消息内容（视频）",
    });

const ChatOrderCardSnapshotSchema = z
    .object({
        title: z.string().min(1).max(120).optional(),
        status: z.string().min(1).max(64).optional(),
        appointmentTime: z.string().min(1).max(64).optional(),
        totalAmount: z.string().min(1).max(64).optional(),
        orderSerial: z.string().min(1).max(64).optional(),
        workerName: z.string().min(1).max(64).optional(),
        workerAvatar: z.string().min(1).max(255).optional(),
        workerAvatarBlurhash: z.string().min(1).optional(),
    })
    .meta({
        title: "订单卡片快照",
        description: "用于聊天列表渲染的订单卡片最小快照（非强一致）",
    });

const ChatOrderCardContentSchema = z
    .object({
        type: z.literal("order_card"),
        orderId: z.string().min(1).max(255),
        snapshot: ChatOrderCardSnapshotSchema.optional(),
    })
    .meta({
        title: "私聊订单卡片消息",
        description: "私聊消息内容（订单卡片）",
    });

export const ChatMessageContentSchema = z
    .discriminatedUnion("type", [
        ChatTextContentSchema,
        ChatImageContentSchema,
        ChatVideoContentSchema,
        ChatOrderCardContentSchema,
    ])
    .meta({
        title: "私聊消息内容",
        description: "私聊消息 content JSON 规范（union）",
    });

export type ChatMessageContent = z.infer<typeof ChatMessageContentSchema>;

export const ChatUpsertConversationSchema = z
    .object({
        peerUserId: z.string().min(1).max(255),
    })
    .meta({
        title: "创建/获取会话",
        description: "与对方创建/获取 1v1 会话（后端会做角色与参与者归一化）",
    });

export type ChatUpsertConversationDto = z.infer<
    typeof ChatUpsertConversationSchema
>;

export const ChatConversationSchema = z
    .object({
        id: z.string().min(1),
        userId: z.string().min(1),
        workerUserId: z.string().min(1),
        lastMessageAt: z.iso.datetime({ offset: true, local: true }).nullable(),
        createdAt: z.iso.datetime({ offset: true, local: true }),
        updatedAt: z.iso.datetime({ offset: true, local: true }),
    })
    .meta({
        title: "私聊会话",
        description: "私聊 1v1 会话实体",
    });

export type ChatConversation = z.infer<typeof ChatConversationSchema>;

export const ChatConversationListQuerySchema = z
    .object({
        limit: z.number().int().min(1).max(100).optional(),
    })
    .meta({
        title: "私聊会话列表查询",
        description: "会话列表查询参数",
    });

export type ChatConversationListQuery = z.infer<
    typeof ChatConversationListQuerySchema
>;

export const ChatConversationListResponseSchema = z
    .object({
        items: z.array(ChatConversationSchema),
    })
    .meta({
        title: "私聊会话列表响应",
        description: "会话列表响应",
    });

export type ChatConversationListResponse = z.infer<
    typeof ChatConversationListResponseSchema
>;

export const ChatMessageSchema = z
    .object({
        id: z.string().min(1),
        conversationId: z.string().min(1),
        senderUserId: z.string().min(1),
        clientMsgId: z.string().min(1).nullable(),
        content: ChatMessageContentSchema,
        createdAt: z.iso.datetime({ offset: true, local: true }),
    })
    .meta({
        title: "私聊消息",
        description: "私聊消息实体（历史/实时）",
    });

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatMessageListQuerySchema = z
    .object({
        conversationId: z.string().min(1),
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(50).optional(),
    })
    .meta({
        title: "私聊消息分页查询",
        description: "消息分页：cursor 为 messageId（服务端会定位游标消息）",
    });

export type ChatMessageListQuery = z.infer<typeof ChatMessageListQuerySchema>;

export const ChatMessageListResponseSchema = z
    .object({
        items: z.array(ChatMessageSchema),
        nextCursor: z.string().nullable(),
    })
    .meta({
        title: "私聊消息分页响应",
        description: "消息分页响应（倒序）",
    });

export type ChatMessageListResponse = z.infer<
    typeof ChatMessageListResponseSchema
>;

export const ChatCreateBlockSchema = z
    .object({
        blockedUserId: z.string().min(1).max(255),
    })
    .meta({
        title: "拉黑用户",
        description: "拉黑对方（双方后续禁止发送消息）",
    });

export type ChatCreateBlockDto = z.infer<typeof ChatCreateBlockSchema>;

export const ChatCreateReportSchema = z
    .object({
        reportedUserId: z.string().min(1).max(255),
        messageId: z.string().min(1).max(255).optional(),
        reason: z.string().min(1).max(200),
        detail: z.record(z.string(), z.unknown()).optional(),
    })
    .meta({
        title: "举报",
        description: "举报对方，可选携带 messageId 作为证据",
    });

export type ChatCreateReportDto = z.infer<typeof ChatCreateReportSchema>;

export const CHAT_SOCKET_SERVER_EVENT = "chat:message" as const;
export const CHAT_SOCKET_CLIENT_EVENT = "chat:client" as const;

export enum ChatSocketEventType {
    Message = "message",
    Error = "error",
}

export enum ChatSocketClientEventType {
    Send = "send",
    Join = "join",
}

export type ChatSocketClientMessage =
    | {
          type: ChatSocketClientEventType.Send;
          conversationId: string;
          content: ChatMessageContent;
          clientMsgId?: string;
      }
    | {
          type: ChatSocketClientEventType.Send;
          peerUserId: string;
          content: ChatMessageContent;
          clientMsgId?: string;
      }
    | {
          type: ChatSocketClientEventType.Join;
          conversationId: string;
      };

export type ChatSocketServerMessage =
    | {
          type: ChatSocketEventType.Message;
          conversationId: string;
          message: ChatMessage;
      }
    | {
          type: ChatSocketEventType.Error;
          code: string;
          message: string;
      };
