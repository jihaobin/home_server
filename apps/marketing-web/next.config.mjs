/** @type {import('next').NextConfig} */
const nextConfig = {
    reactCompiler: true,
    experimental: {
        // Allow importing assets from other apps in this monorepo.
        externalDir: true,
    },
};

export default nextConfig;
