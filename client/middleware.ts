// client/middleware.ts or /middleware.ts (depending on monorepo vs single app)
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // For now, we'll just pass through all requests
  // We'll handle authentication in the AuthContext component
  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next/|api/socket).*)',
    // Optional: Match API routes
    '/api/:path*',
  ],
}
