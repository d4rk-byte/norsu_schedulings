import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import type { ReactNode } from 'react'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  onDismiss?: () => void
  className?: string
}

const variantConfig: Record<AlertVariant, { bg: string; border: string; text: string; icon: typeof Info }> = {
  success: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', icon: CheckCircle2 },
  error: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: AlertCircle },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: Info },
}

export function Alert({ variant = 'info', title, children, onDismiss, className }: AlertProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        config.bg,
        config.border,
        config.text,
        className,
      )}
      role="alert"
    >
      <div className="flex">
        <Icon className="h-5 w-5 flex-shrink-0 mr-3" />
        <div className="flex-1">
          {title && <p className="font-medium">{title}</p>}
          <div className={cn('text-sm', title && 'mt-1')}>{children}</div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-3 flex-shrink-0 hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export type { AlertProps, AlertVariant }
