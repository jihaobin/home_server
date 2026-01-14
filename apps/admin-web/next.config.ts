import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
/* config options here */
  basePath: "/admin",
  typescript: { ignoreBuildErrors: true },
  reactCompiler: true,
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev',"192.168.0.110"],
  images: {
    remotePatterns: [
        {
            protocol: 'http',
            hostname: '192.168.0.110',
            port: '9000',
            pathname: '/**',
        }
    ]
  }
}

export default nextConfig
