import { ImageResponse } from "next/og";

import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export const size = {
    width: 512,
    height: 512,
};

export const contentType = "image/png";

export default async function Icon() {
    // Reuse the Expo app icon as the website favicon.
    const iconPath = path.resolve(
        process.cwd(),
        "..",
        "mobile-user",
        "assets",
        "images",
        "icon.png",
    );
    const bytes = await fs.readFile(iconPath);
    const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
            }}
        >
            <img
                src={dataUrl}
                width={512}
                height={512}
                style={{
                    width: 512,
                    height: 512,
                }}
            />
        </div>,
        size,
    );
}
