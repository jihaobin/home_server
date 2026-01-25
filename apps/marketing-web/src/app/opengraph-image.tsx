import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const runtime = "edge";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

export default function OpengraphImage() {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,247,237,1) 40%, rgba(255,255,255,1) 100%)",
            }}
        >
            <div
                style={{
                    width: 1040,
                    height: 470,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: 64,
                    borderRadius: 48,
                    border: "1px solid rgba(15, 23, 42, 0.10)",
                    background:
                        "radial-gradient(circle at 20% 10%, rgba(255, 179, 0, 0.30) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(255, 179, 0, 0.22) 0%, transparent 50%), rgba(255,255,255,0.92)",
                }}
            >
                <div
                    style={{
                        fontSize: 56,
                        fontWeight: 800,
                        letterSpacing: -1,
                        color: "#0f172a",
                    }}
                >
                    {SITE_NAME}
                </div>
                <div
                    style={{
                        marginTop: 18,
                        fontSize: 36,
                        fontWeight: 700,
                        color: "rgba(15, 23, 42, 0.78)",
                    }}
                >
                    专业团队到家，30 分钟极速响应
                </div>
                <div
                    style={{
                        marginTop: 26,
                        fontSize: 22,
                        color: "rgba(15, 23, 42, 0.60)",
                    }}
                >
                    dingsm.com
                </div>
            </div>
        </div>,
        size,
    );
}
