import axios from 'axios'
import Cookies from 'js-cookie'

function normalizeApiBaseUrl(rawUrl: string | undefined): string {
  const fallback = 'http://localhost:8000'
  const value = (rawUrl || fallback).trim()

  if (!value) return fallback

  // Accept either https://host or https://host/api in env config.
  return value.replace(/\/+$/, '').replace(/\/api$/i, '')
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL),
  headers: { 'Content-Type': 'application/json' },
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
  (error) => {
    const status = error.response?.status
    const requestUrl = String(error.config?.url || '')
    const isLoginRequest = requestUrl.includes('/api/login')

    if (status === 401 && !isLoginRequest) {
      Cookies.remove('auth_token')
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
