import * as React from "react";
import type { ImageSource } from "expo-image";
import { createVideoPlayer } from "expo-video";

const thumbnailCache = new Map<string, ImageSource>();
const pendingTasks = new Map<string, Promise<ImageSource | null>>();

async function generateThumbnail(uri: string): Promise<ImageSource | null> {
    const cached = thumbnailCache.get(uri);
    if (cached) {
        return cached;
    }

    const running = pendingTasks.get(uri);
    if (running) {
        return await running;
    }

    const task = (async () => {
        const player = createVideoPlayer(uri);
        try {
            const thumbnails = await player.generateThumbnailsAsync([0]);
            const first = thumbnails[0] ?? null;
            if (first) {
                thumbnailCache.set(uri, first);
                return first;
            }
            return null;
        } catch {
            return null;
        } finally {
            player.release();
            pendingTasks.delete(uri);
        }
    })();

    pendingTasks.set(uri, task);
    return await task;
}

export function useLocalVideoThumbnail(uri?: string) {
    const [thumbnail, setThumbnail] = React.useState<ImageSource | null>(() =>
        uri ? (thumbnailCache.get(uri) ?? null) : null,
    );
    const [isGenerating, setIsGenerating] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        if (!uri) {
            setThumbnail(null);
            setIsGenerating(false);
            return;
        }

        const cached = thumbnailCache.get(uri);
        if (cached) {
            setThumbnail(cached);
            setIsGenerating(false);
            return;
        }

        setIsGenerating(true);
        void (async () => {
            const nextThumbnail = await generateThumbnail(uri);
            if (!cancelled) {
                setThumbnail(nextThumbnail);
                setIsGenerating(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [uri]);

    return {
        thumbnail,
        isGenerating,
    };
}
