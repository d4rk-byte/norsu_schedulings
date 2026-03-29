'use client'

import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { Spinner } from './Spinner'
import { Fragment, type ReactNode } from 'react'

// Column definition
export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (item: T) => ReactNode
}

// Sort state
export interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  sort?: SortState | null
  onSort?: (sort: SortState) => void
  onRowClick?: (item: T) => void
  expandedRowKey?: string | number | null
  renderExpandedRow?: (item: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyAction,
  sort,
  onSort,
  onRowClick,
  expandedRowKey,
  renderExpandedRow,
  className,
}: DataTableProps<T>) {
  function handleSort(key: string) {
    if (!onSort) return
    if (sort?.key === key) {
      onSort({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      onSort({ key, direction: 'asc' })
    }
  }

  function getSortIcon(key: string) {
    if (sort?.key !== key) return <ChevronsUpDown className="h-3.5 w-3.5 text-stone-400" />
    return sort.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-primary-600" />
      : <ChevronDown className="h-3.5 w-3.5 text-primary-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-stone-200 dark:divide-gray-700">
        <thead className="bg-stone-50 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-gray-400 uppercase tracking-wider',
                  col.sortable && 'cursor-pointer select-none hover:text-stone-700 dark:hover:text-gray-200',
                  col.className,
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && getSortIcon(col.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-stone-200 dark:divide-gray-700">
          {data.map((item) => {
            const rowKey = keyExtractor(item)
            const isExpanded = expandedRowKey !== null && expandedRowKey !== undefined && expandedRowKey === rowKey

            return (
              <Fragment key={rowKey}>
                <tr
                  className={cn(
                    'transition-colors hover:bg-stone-50 dark:hover:bg-gray-800',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-sm text-stone-700 dark:text-gray-300', col.className)}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>

                {isExpanded && renderExpandedRow && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-3 bg-stone-50/70 dark:bg-gray-800/60">
                      {renderExpandedRow(item)}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
