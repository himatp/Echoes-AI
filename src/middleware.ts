import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware
 * Simplified to instant pass-through (0ms latency) to eliminate Vercel EDGE MIDDLEWARE_INVOCATION_TIMEOUT (504 Gateway Timeout).
 * All authentication, session hydration, and route gating are managed reliably client-side via AuthProvider.tsx.
 */
export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static media (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
