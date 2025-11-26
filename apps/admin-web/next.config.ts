import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  typescript: { ignoreBuildErrors: true },
  reactCompiler: true,
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev',"192.168.0.110"],
}

export default nextConfig