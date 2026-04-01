'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { activityLogsApi } from '@/lib/admin-api'
import type { ActivityLog } from '@/types'

interface ActivityLogRow {
  id: number
  createdAt: string
  action: string
  description: string
  userName: string
  userRole: string
}

function formatTimestamp(value: string): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function humanizeAction(value: string): string {
  if (!value) return '-'

  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params: Record<string, unknown> = {
        page: 1,
        limit: 500,
      }

      if (search.trim()) {
        params.search = search.trim()
      }

      if (actionFilter !== 'all') {
        params.action = actionFilter
      }

      const result = await activityLogsApi.list(params)
      setLogs(result.data || [])
    } catch {
      setError('Failed to load activity logs. Please try again.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [actionFilter, search])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const actionOptions = useMemo(() => {
    const uniqueActions = Array.from(new Set(logs.map((log) => log.action).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    )

    return [
      { value: 'all', label: 'All Actions' },
      ...uniqueActions.map((action) => ({ value: action, label: humanizeAction(action) })),
    ]
  }, [logs])

  const rows = useMemo<ActivityLogRow[]>(() => {
    return logs.map((log) => {
      const user = log.user as unknown as
        | {
            fullName?: string | null
            firstName?: string | null
            lastName?: string | null
            roleDisplayName?: string | null
          }
        | null

      const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()

      return {
        id: log.id,
        createdAt: formatTimestamp(log.createdAt),
        action: humanizeAction(log.action),
        description: log.description || '-',
        userName: user?.fullName || fallbackName || 'System',
        userRole: user?.roleDisplayName || 'System',
      }
    })
  }, [logs])

  const columns: Column<ActivityLogRow>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      className: 'whitespace-nowrap',
    },
    {
      key: 'action',
      header: 'Action',
      className: 'whitespace-nowrap',
    },
    {
      key: 'description',
      header: 'Description',
    },
    {
      key: 'userName',
      header: 'User',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span>{row.userName}</span>
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-500/15 dark:text-brand-300">
            {row.userRole}
          </span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Activity Logs</h1>
        <p className="text-sm text-stone-500 dark:text-gray-400">Track system actions and user operations.</p>
      </div>

      <Card>
        <CardHeader
          title="Filters"
          description="Search logs and narrow by action type."
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => {
                setSearch('')
                setActionFilter('all')
              }}>
                Clear
              </Button>
              <Button onClick={() => void loadLogs()}>
                Refresh
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search description or user..."
            className="md:col-span-2"
          />

          <Select
            options={actionOptions}
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          />
        </div>

        <div className="mt-3">
          <Button onClick={() => void loadLogs()}>Apply Filters</Button>
        </div>
      </Card>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <Card>
        <CardHeader title="Activity Entries" description={`Showing ${rows.length} item(s)`} />

        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(row) => row.id}
          loading={loading}
          emptyTitle="No activity logs found"
          emptyDescription="Try a different filter or refresh the list."
        />
      </Card>
    </div>
  )
}
