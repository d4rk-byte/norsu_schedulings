'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import { ROLES, ROLE_DASHBOARDS } from '@/lib/constants'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<string>
  logout: () => Promise<void>
  isAdmin: boolean
  isDeptHead: boolean
  isFaculty: boolean
  getDashboardPath: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Decode JWT payload (without verification — server handles that)
function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

// Extract the integer role from JWT payload.
// Supports both the custom `role` integer and Lexik's `roles` string array.
function extractRoleFromPayload(payload: Record<string, unknown>): number {
  if (typeof payload.role === 'number') {
    return payload.role
  }
  if (Array.isArray(payload.roles)) {
    const roles = payload.roles as string[]
    if (roles.includes('ROLE_ADMIN')) return 1
    if (roles.includes('ROLE_DEPARTMENT_HEAD')) return 2
    if (roles.includes('ROLE_FACULTY')) return 3
  }
  return 0
}

// Map role -> profile API base path
const ROLE_API_PREFIX: Record<number, string> = {
  [ROLES.ADMIN]: '/api/admin',
  [ROLES.DEPARTMENT_HEAD]: '/api/department-head',
  [ROLES.FACULTY]: '/api/faculty',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Build a User object from the decoded JWT payload
  function userFromPayload(payload: Record<string, unknown>): User {
    const role = extractRoleFromPayload(payload)
    return {
      id: (payload.user_id as number) || 0,
      username: (payload.username as string) || '',
      email: (payload.email as string) || '',
      firstName: null,
      middleName: null,
      lastName: null,
      fullName: (payload.username as string) || '',
      role,
      roleString: '',
      roleDisplayName: '',
      employeeId: null,
      position: null,
      address: null,
      otherDesignation: null,
      isActive: true,
      lastLogin: null,
      college: null,
      department: null,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    }
  }

  // Load user profile from API (called on mount / page load)
  const loadUser = useCallback(async (token: string) => {
    try {
      const payload = decodeToken(token)
      if (!payload) throw new Error('Invalid token')

      const role = extractRoleFromPayload(payload)
      let userData: User | null = null

      const apiPrefix = ROLE_API_PREFIX[role]

      if (apiPrefix) {
        try {
          const res = await api.get(`${apiPrefix}/profile`)
          const data = res.data
          userData = {
            id: data.id,
            username: data.username,
            email: data.email,
            firstName: data.first_name,
            middleName: data.middle_name,
            lastName: data.last_name,
            fullName: data.full_name,
            role: data.role ?? role,
            roleString: data.role_string ?? '',
            roleDisplayName: data.role_display_name ?? '',
            employeeId: data.employee_id,
            position: data.position,
            address: data.address,
            otherDesignation: data.other_designation,
            isActive: data.is_active ?? true,
            lastLogin: data.last_login ?? null,
            college: data.college,
            department: data.department,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            deletedAt: data.deleted_at ?? null,
          }
        } catch {
          // Profile API failed — fall back to token data
          userData = userFromPayload(payload)
        }
      } else {
        userData = userFromPayload(payload)
      }

      setState({
        user: userData,
        token,
        isLoading: false,
        isAuthenticated: true,
      })
    } catch {
      // Token invalid — clear it
      Cookies.remove('auth_token')
      setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  // On mount, check for existing token
  useEffect(() => {
    const token = Cookies.get('auth_token')
    if (token) {
      loadUser(token)
    } else {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [loadUser])

  const login = async (identifier: string, password: string): Promise<string> => {
    // Keep `email` as payload key to match Symfony json_login username_path.
    const response = await api.post('/api/login', { email: identifier, password })
    const { token } = response.data

    // Store token in cookie (expires in 24h matching JWT TTL)
    Cookies.set('auth_token', token, { expires: 1, sameSite: 'lax' })

    // Derive dashboard path and user from token directly — no async API
    // calls here to avoid interfering with the redirect.
    const payload = decodeToken(token)
    const role = payload ? extractRoleFromPayload(payload) : 0
    const dashboardPath = ROLE_DASHBOARDS[role] || '/login'

    // Set auth state synchronously from token (profile will refresh on mount)
    if (payload) {
      setState({
        user: userFromPayload(payload),
        token,
        isLoading: false,
        isAuthenticated: true,
      })
    }

    return dashboardPath
  }

  const logout = async () => {
    // Best effort: record logout server-side for activity logs.
    try {
      await api.post('/api/logout')
    } catch {
      // Ignore failures and continue with client logout.
    }

    Cookies.remove('auth_token')
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
    window.location.href = '/login'
  }

  const isAdmin = state.user?.role === ROLES.ADMIN
  const isDeptHead = state.user?.role === ROLES.DEPARTMENT_HEAD
  const isFaculty = state.user?.role === ROLES.FACULTY

  const getDashboardPath = () => {
    if (!state.user) return '/login'
    return ROLE_DASHBOARDS[state.user.role] || '/login'
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAdmin, isDeptHead, isFaculty, getDashboardPath }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
