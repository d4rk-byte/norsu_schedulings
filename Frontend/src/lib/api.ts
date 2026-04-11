import axios, { type InternalAxiosRequestConfig } from 'axios'
import Cookies from 'js-cookie'

function normalizeApiBaseUrl(rawUrl: string | undefined): string {
  const fallback = ''
  const value = (rawUrl || fallback).trim()

  if (!value) return fallback

  // Accept either https://host or https://host/api in env config.
  return value.replace(/\/+$/, '').replace(/\/api$/i, '')
}

function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

interface RetryableAxiosConfig extends InternalAxiosRequestConfig {
  _sameOriginRetry?: boolean
}

const configuredBaseUrl = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)
const hasAbsoluteConfiguredBaseUrl = isAbsoluteHttpUrl(configuredBaseUrl)
const isBrowser = typeof window !== 'undefined'
const isProduction = process.env.NODE_ENV === 'production'

// Use same-origin browser routing in development to avoid tunnel/CORS friction.
// In production, keep direct absolute API URL behavior when configured.
const useSameOriginInBrowser = isBrowser && (!isProduction || !hasAbsoluteConfiguredBaseUrl)
const resolvedBaseUrl = useSameOriginInBrowser ? '' : configuredBaseUrl

const api = axios.create({
  // Use same-origin routing by default so Next.js rewrites can proxy backend calls.
  baseURL: resolvedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    ...(!useSameOriginInBrowser && configuredBaseUrl.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
  },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const isAxiosErr = axios.isAxiosError(error)

    // If a configured external origin is down (e.g. expired tunnel), retry once via same-origin.
    if (isAxiosErr && !error.response && error.config && hasAbsoluteConfiguredBaseUrl) {
      const retryConfig = error.config as RetryableAxiosConfig
      if (!retryConfig._sameOriginRetry && retryConfig.baseURL !== '') {
        retryConfig._sameOriginRetry = true
        retryConfig.baseURL = ''
        return api.request(retryConfig)
      }
    }

    // If absolute API origin is stale/misrouted and responds 404,
    // retry once through same-origin rewrites before surfacing the error.
    if (isAxiosErr && error.response?.status === 404 && error.config && hasAbsoluteConfiguredBaseUrl) {
      const retryConfig = error.config as RetryableAxiosConfig
      if (!retryConfig._sameOriginRetry && retryConfig.baseURL !== '') {
        retryConfig._sameOriginRetry = true
        retryConfig.baseURL = ''
        return api.request(retryConfig)
      }
    }

    const status = isAxiosErr ? error.response?.status : undefined
    const requestUrl = isAxiosErr ? String(error.config?.url || '') : ''
    const isLoginRequest = requestUrl.includes('/api/login')

    if (status === 401 && !isLoginRequest) {
      Cookies.remove('auth_token', { path: '/' })
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    // Avoid propagating undefined/null rejections that trigger
    // opaque "unhandledRejection: undefined" runtime errors.
    if (error === null || error === undefined) {
      return Promise.reject(new Error('Request failed with an unknown error.'))
    }

    if (typeof error === 'string') {
      return Promise.reject(new Error(error))
    }

    return Promise.reject(error)
  }
)

export default api
