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
}

export default nextConfig
