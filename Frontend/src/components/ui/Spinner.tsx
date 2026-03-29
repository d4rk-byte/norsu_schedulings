'use client'

import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-stone-300 dark:border-gray-600 border-t-primary-600',
        sizeStyles[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner size="lg" />
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}
