import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-sm border border-stone-200 dark:bg-gray-800 dark:border-gray-700',
        paddingStyles[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div>
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white">{title}</h3>
        {description && <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export type { CardProps, CardHeaderProps }
