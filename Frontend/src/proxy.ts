import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/signup', '/signin', '/reset-password']

// Role-based route prefixes
const ROLE_ROUTES: Record<string, number> = {
  '/admin': 1,           // ROLE_ADMIN
  '/department-head': 2, // ROLE_DEPARTMENT_HEAD
  '/faculty': 3,         // ROLE_FACULTY
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

// Extract the integer role from the JWT payload.
// Supports both the custom `role` integer claim and Lexik's `roles` string array.
function extractRole(payload: Record<string, unknown>): number | null {
  // Prefer the explicit integer field added by JWTCreatedSubscriber
  if (typeof payload.role === 'number') {
    return payload.role
  }
  // Fallback: derive from Lexik's roles array (e.g. ["ROLE_USER", "ROLE_ADMIN"])
  if (Array.isArray(payload.roles)) {
    const roles = payload.roles as string[]
    if (roles.includes('ROLE_ADMIN')) return 1
    if (roles.includes('ROLE_DEPARTMENT_HEAD')) return 2
    if (roles.includes('ROLE_FACULTY')) return 3
  }
  return null
}

function getRoleDashboard(role: number | null): string {
  switch (role) {
    case 1: return '/admin/dashboard'
    case 2: return '/department-head/dashboard'
    case 3: return '/faculty/dashboard'
    default: return '/login'
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value

  // API requests are proxied to Symfony via next.config rewrites.
  // They must bypass UI auth redirects in this middleware.
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    // If already authenticated, redirect to dashboard
    if (token) {
      const payload = decodeTokenPayload(token)
      if (payload) {
        const role = extractRole(payload)
        const dashboard = getRoleDashboard(role)
        // Prevent redirect loop: only redirect if dashboard is NOT a public route
        if (dashboard !== '/login') {
          return NextResponse.redirect(new URL(dashboard, request.url))
        }
      }
    }
    return NextResponse.next()
  }

  // All other routes require authentication
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = decodeTokenPayload(token)
  if (!payload) {
    // Token invalid or expired
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }

  const userRole = extractRole(payload)

  // If we can't determine the role, clear the cookie and redirect to login
  if (userRole === null) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }

  // Check role-based access
  for (const [routePrefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(routePrefix) && userRole !== requiredRole) {
      // User doesn't have the required role — redirect to their dashboard
      const dashboard = getRoleDashboard(userRole)
      return NextResponse.redirect(new URL(dashboard, request.url))
    }
  }

  // Root path — redirect to role dashboard
  if (pathname === '/') {
    const dashboard = getRoleDashboard(userRole)
    return NextResponse.redirect(new URL(dashboard, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
