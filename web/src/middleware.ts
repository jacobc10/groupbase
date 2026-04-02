import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Update session and refresh auth token
  const response = await updateSession(request)

  // Protect dashboard routes — check for Supabase auth cookie
  if (pathname.startsWith('/dashboard')) {
    // Supabase stores auth in cookies prefixed with sb-<ref>-auth-token
    const cookies = request.cookies.getAll()
    const hasAuthCookie = cookies.some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    )

    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Redirect logged-in users away from login/signup
  if (pathname === '/login' || pathname === '/signup') {
    const cookies = request.cookies.getAll()
    const hasAuthCookie = cookies.some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    )

    if (hasAuthCookie) {
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
