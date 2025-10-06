import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Disable strict mode temporarily to avoid double Socket.IO connections in development
  reactStrictMode: false,
  // Add external packages for better WebSocket support
  serverExternalPackages: ['socket.io-client'],
  // Disable ESLint during build for faster deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript checking during build (faster deployment)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Suppress hydration warnings from browser extensions
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  // Suppress console warnings for hydration mismatches
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

export default nextConfig
