import { useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";

import { useUploadFile } from "@repo/hooks/api/files";

import { useChatSendMessage } from "./use-chat-send-message";

export function useChatSendAttachments(params: { conversationId: string }) {
    const uploadFile = useUploadFile();
    const { send } = useChatSendMessage({
        conversationId: params.conversationId,
    });

    const sendImageFromLibrary = useCallback(async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            toast.error("需要访问相册权限才能选择图片");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });
        if (result.canceled || !result.assets?.length) {
            return;
        }
        const asset = result.assets[0];

        const uploaded = await uploadFile.mutateAsync({
            file: {
                uri: asset.uri,
                name: asset.fileName || `chat_image_${Date.now()}.jpg`,
                type: asset.mimeType || "image/jpeg",
            },
        });

        send({
            type: "image",
            fileId: uploaded.id,
            blurhash: uploaded.blurhash,
            width: asset.width,
            height: asset.height,
        });
    }, [send, uploadFile]);

    const sendVideoFromLibrary = useCallback(async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            toast.error("需要访问相册权限才能选择视频");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 1,
        });
        if (result.canceled || !result.assets?.length) {
            return;
        }
        const asset = result.assets[0];

        const uploaded = await uploadFile.mutateAsync({
            file: {
                uri: asset.uri,
                name: asset.fileName || `chat_video_${Date.now()}.mp4`,
                type: asset.mimeType || "video/mp4",
            },
        });

        send({
            type: "video",
            fileId: uploaded.id,
        });
    }, [send, uploadFile]);

    return {
        sendImageFromLibrary,
        sendVideoFromLibrary,
        isUploading: uploadFile.isPending,
    };
}
