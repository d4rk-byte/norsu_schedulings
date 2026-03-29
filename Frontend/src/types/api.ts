// API response wrapper types

export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: { conflicts?: string[] }
}

export interface ApiListResponse<T> {
  success: boolean
  data: T[]
  meta: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  success: false
  error: {
    code: number
    message: string
    details?: Record<string, string>
  }
}
