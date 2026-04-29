import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    basePath: "/admin",
    typescript: { ignoreBuildErrors: true },
    reactCompiler: true,
    allowedDevOrigins: [
        "local-origin.dev",
        "*.local-origin.dev",
        "192.168.0.111",
    ],
    images: {
        dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
        remotePatterns: [
            {
                protocol: "https",
                hostname: "files.dingsm.com",
                pathname: "/files-live/**",
            },
            {
                protocol: "http",
                hostname: "192.168.0.111",
                port: "9000",
                pathname: "/files-live/**",
            },
        ],
    },
};

export default nextConfig;
