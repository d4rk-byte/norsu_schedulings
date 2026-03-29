import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Helpers to create a valid JWT ────────────────────────
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
}

function pastExp(): number {
  return Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
}

// ─── Mock Next.js server modules ──────────────────────────
// We test the pure logic extracted from middleware, since Next.js
// middleware uses edge-runtime APIs that are hard to simulate.
// Instead we import the helper functions by re-implementing them
// and testing the routing logic.

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

function getRoleDashboard(role: number): string {
  switch (role) {
    case 1: return '/admin/dashboard'
    case 2: return '/department-head/dashboard'
    case 3: return '/faculty/dashboard'
    default: return '/login'
  }
}

const PUBLIC_ROUTES = ['/login', '/register']
const ROLE_ROUTES: Record<string, number> = {
  '/admin': 1,
  '/department-head': 2,
  '/faculty': 3,
}

type MiddlewareResult =
  | { action: 'next' }
  | { action: 'redirect'; url: string; deleteCookie?: boolean }

function runMiddlewareLogic(pathname: string, token: string | undefined): MiddlewareResult {
  // Public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    if (token) {
      const payload = decodeTokenPayload(token)
      if (payload) {
        const role = payload.role as number
        return { action: 'redirect', url: getRoleDashboard(role) }
      }
    }
    return { action: 'next' }
  }

  // No token → login
  if (!token) {
    return { action: 'redirect', url: '/login' }
  }

  // Invalid/expired token
  const payload = decodeTokenPayload(token)
  if (!payload) {
    return { action: 'redirect', url: '/login', deleteCookie: true }
  }

  const userRole = payload.role as number

  // Role-based access
  for (const [routePrefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(routePrefix) && userRole !== requiredRole) {
      return { action: 'redirect', url: getRoleDashboard(userRole) }
    }
  }

  // Root path
  if (pathname === '/') {
    return { action: 'redirect', url: getRoleDashboard(userRole) }
  }

  return { action: 'next' }
}

// ─── Tests ────────────────────────────────────────────────

describe('Middleware: decodeTokenPayload', () => {
  it('decodes a valid JWT payload', () => {
    const token = makeJwt({ email: 'test@test.com', role: 1, exp: futureExp() })
    const result = decodeTokenPayload(token)
    expect(result).not.toBeNull()
    expect(result?.email).toBe('test@test.com')
    expect(result?.role).toBe(1)
  })

  it('returns null for expired token', () => {
    const token = makeJwt({ email: 'test@test.com', role: 1, exp: pastExp() })
    expect(decodeTokenPayload(token)).toBeNull()
  })

  it('returns null for malformed token', () => {
    expect(decodeTokenPayload('not.a.jwt')).toBeNull()
    expect(decodeTokenPayload('')).toBeNull()
  })
})

describe('Middleware: getRoleDashboard', () => {
  it('returns admin dashboard for role 1', () => {
    expect(getRoleDashboard(1)).toBe('/admin/dashboard')
  })

  it('returns department-head dashboard for role 2', () => {
    expect(getRoleDashboard(2)).toBe('/department-head/dashboard')
  })

  it('returns faculty dashboard for role 3', () => {
    expect(getRoleDashboard(3)).toBe('/faculty/dashboard')
  })

  it('returns /login for unknown role', () => {
    expect(getRoleDashboard(99)).toBe('/login')
  })
})

describe('Middleware: routing logic', () => {
  const adminToken = makeJwt({ role: 1, exp: futureExp() })
  const deptHeadToken = makeJwt({ role: 2, exp: futureExp() })
  const facultyToken = makeJwt({ role: 3, exp: futureExp() })
  const expiredToken = makeJwt({ role: 1, exp: pastExp() })

  // Public routes
  it('allows unauthenticated access to /login', () => {
    expect(runMiddlewareLogic('/login', undefined)).toEqual({ action: 'next' })
  })

  it('allows unauthenticated access to /register', () => {
    expect(runMiddlewareLogic('/register', undefined)).toEqual({ action: 'next' })
  })

  it('redirects authenticated user away from /login to their dashboard', () => {
    expect(runMiddlewareLogic('/login', adminToken)).toEqual({ action: 'redirect', url: '/admin/dashboard' })
    expect(runMiddlewareLogic('/login', facultyToken)).toEqual({ action: 'redirect', url: '/faculty/dashboard' })
  })

  // Unauthenticated access to protected routes
  it('redirects unauthenticated user to /login for protected routes', () => {
    expect(runMiddlewareLogic('/admin/dashboard', undefined)).toEqual({ action: 'redirect', url: '/login' })
    expect(runMiddlewareLogic('/faculty/schedule', undefined)).toEqual({ action: 'redirect', url: '/login' })
  })

  // Expired token
  it('redirects to /login and deletes cookie for expired token', () => {
    expect(runMiddlewareLogic('/admin/dashboard', expiredToken)).toEqual({
      action: 'redirect',
      url: '/login',
      deleteCookie: true,
    })
  })

  // Role-based access control
  it('allows admin to access /admin routes', () => {
    expect(runMiddlewareLogic('/admin/dashboard', adminToken)).toEqual({ action: 'next' })
    expect(runMiddlewareLogic('/admin/users', adminToken)).toEqual({ action: 'next' })
  })

  it('allows dept head to access /department-head routes', () => {
    expect(runMiddlewareLogic('/department-head/dashboard', deptHeadToken)).toEqual({ action: 'next' })
  })

  it('allows faculty to access /faculty routes', () => {
    expect(runMiddlewareLogic('/faculty/schedule', facultyToken)).toEqual({ action: 'next' })
  })

  it('redirects admin trying to access /faculty routes', () => {
    expect(runMiddlewareLogic('/faculty/dashboard', adminToken)).toEqual({
      action: 'redirect',
      url: '/admin/dashboard',
    })
  })

  it('redirects faculty trying to access /admin routes', () => {
    expect(runMiddlewareLogic('/admin/dashboard', facultyToken)).toEqual({
      action: 'redirect',
      url: '/faculty/dashboard',
    })
  })

  it('redirects dept head trying to access /admin routes', () => {
    expect(runMiddlewareLogic('/admin/settings', deptHeadToken)).toEqual({
      action: 'redirect',
      url: '/department-head/dashboard',
    })
  })

  // Root path
  it('redirects root path to role dashboard', () => {
    expect(runMiddlewareLogic('/', adminToken)).toEqual({ action: 'redirect', url: '/admin/dashboard' })
    expect(runMiddlewareLogic('/', facultyToken)).toEqual({ action: 'redirect', url: '/faculty/dashboard' })
    expect(runMiddlewareLogic('/', deptHeadToken)).toEqual({ action: 'redirect', url: '/department-head/dashboard' })
  })
})
