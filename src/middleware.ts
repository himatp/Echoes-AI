import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. Bypass middleware immediately for all API routes to prevent Edge Middleware timeouts
  if (path.startsWith('/api')) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // If Supabase environment variables are missing, bypass middleware
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Allow public access to login and auth callback endpoints
  const isPublicRoute =
    path.startsWith('/login') ||
    path.startsWith('/auth/callback');

  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    // Preserve invite code query param if user was accessing /login?invite=CODE
    const invite = request.nextUrl.searchParams.get('invite');
    if (invite) {
      loginUrl.searchParams.set('invite', invite);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from /login page to dashboard
  if (user && path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api/ (API routes - bypass middleware to eliminate MIDDLEWARE_INVOCATION_TIMEOUT)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static images (.svg, .png, .jpg, etc.)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
