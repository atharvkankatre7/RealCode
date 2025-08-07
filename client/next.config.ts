import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Add configuration for better Socket.IO support
  async headers() {
    return [
      {
        // Apply CORS headers to all API routes and Socket.IO connections
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
          },
        ],
      },
    ];
  },
  // Disable strict mode temporarily to avoid double Socket.IO connections in development
  reactStrictMode: false,
  // Add external packages for better WebSocket support
  serverExternalPackages: ['socket.io-client'],
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
