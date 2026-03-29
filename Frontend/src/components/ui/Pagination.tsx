'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  pageSize?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  // Build page numbers to show
  function getPageNumbers(): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = []
    const delta = 1 // pages around current

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis')
      }
    }
    return pages
  }

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null
  const endItem = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {totalItems != null && (
        <p className="text-sm text-stone-500 dark:text-gray-400">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </p>
      )}

      <nav className="flex items-center gap-1 ml-auto" aria-label="Pagination">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-500 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-stone-400 dark:text-gray-500">
              &hellip;
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                'inline-flex items-center justify-center h-8 min-w-[32px] rounded-md text-sm font-medium',
                page === currentPage
                  ? 'bg-primary-600 text-white'
                  : 'border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700',
              )}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-500 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  )
}

export type { PaginationProps }
