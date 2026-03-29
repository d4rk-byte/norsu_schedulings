'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ApiListResponse, PaginationMeta } from '@/types'
import type { ListParams } from '@/lib/admin-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { useDebounce } from './useDebounce'

interface UseCrudListReturn<T> {
  data: T[]
  meta: PaginationMeta
  loading: boolean
  error: string | null
  search: string
  setSearch: (v: string) => void
  page: number
  setPage: (p: number) => void
  sort: { key: string; direction: 'asc' | 'desc' } | null
  setSort: (s: { key: string; direction: 'asc' | 'desc' }) => void
  refresh: () => void
  extraParams: Record<string, unknown>
  setExtraParams: (p: Record<string, unknown>) => void
}

export function useCrudList<T>(
  fetcher: (params: ListParams) => Promise<ApiListResponse<T>>,
  deps: unknown[] = [],
): UseCrudListReturn<T> {
  const [data, setData] = useState<T[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [extraParams, setExtraParams] = useState<Record<string, unknown>>({})

  const debouncedSearch = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: ListParams = {
        page,
        limit: DEFAULT_PAGE_SIZE,
        ...extraParams,
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (sort) {
        params.sort = sort.key
        params.direction = sort.direction
      }
      const result = await fetcher(params)
      setData(result.data)
      setMeta(result.meta)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, sort, extraParams, ...deps])

  useEffect(() => { load() }, [load])

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [debouncedSearch])

  return { data, meta, loading, error, search, setSearch, page, setPage, sort, setSort, refresh: load, extraParams, setExtraParams }
}
