import { ImageResponse } from "next/og";
import { WORKER_SITE_NAME, WORKER_SITE_TAGLINE } from "@/lib/worker-site";

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
                    "linear-gradient(135deg, rgba(2,6,23,1) 0%, rgba(15,23,42,1) 45%, rgba(14,116,144,1) 100%)",
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
                    border: "1px solid rgba(255,255,255,0.12)",
                    background:
                        "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.35) 0%, transparent 35%), radial-gradient(circle at 90% 80%, rgba(34,197,94,0.24) 0%, transparent 45%), rgba(15,23,42,0.78)",
                }}
            >
                <div
                    style={{
                        fontSize: 56,
                        fontWeight: 800,
                        letterSpacing: -1,
                        color: "#ffffff",
                    }}
                >
                    {WORKER_SITE_NAME}
                </div>
                <div
                    style={{
                        marginTop: 18,
                        fontSize: 34,
                        fontWeight: 700,
                        color: "rgba(226,232,240,0.92)",
                    }}
                >
                    {WORKER_SITE_TAGLINE}
                </div>
                <div
                    style={{
                        marginTop: 26,
                        fontSize: 22,
                        color: "rgba(148,163,184,1)",
                    }}
                >
                    dingsm.com/worker-app
                </div>
            </div>
        </div>,
        size,
    );
}
