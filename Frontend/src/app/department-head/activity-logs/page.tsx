'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { dhActivityLogsApi } from '@/lib/department-head-api'
import { formatDistanceToNow } from 'date-fns'
import type { ActivityLog } from '@/lib/department-head-api'

export default function DHActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20
  const [search, setSearch] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dhActivityLogsApi.list({
        page,
        limit,
        search: search || undefined,
      })
      setLogs(res.data || [])
      setTotal(res.meta?.total || 0)
      setError('')
    } catch {
      setError('Failed to load activity logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [limit, page, search])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const columns: Column<ActivityLog>[] = [
    {
      key: 'description',
      header: 'Description',
      sortable: false,
      render: (log) => (
        <div>
          <p className="font-medium text-gray-900">{log.description}</p>
          {log.user && (
            <p className="text-xs text-gray-500">by {log.user.fullName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (log) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-400/30 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
          {log.action.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity Type',
      sortable: true,
      render: (log) => log.entityType || '—',
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      sortable: true,
      render: (log) => (
        <div>
          <p className="text-sm text-gray-900">
            {new Date(log.createdAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </p>
        </div>
      ),
    },
  ]

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          View all activities in your department
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader title="Department Activities" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 px-6 pt-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search activities..."
              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={logs}
          keyExtractor={(log) => log.id}
          loading={loading}
          emptyTitle="No activity logs found"
        />
        <Pagination
          className="mt-4"
          currentPage={page}
          totalPages={Math.ceil(total / limit)}
          totalItems={total}
          pageSize={limit}
          onPageChange={setPage}
        />
      </Card>
    </div>
  )
}
