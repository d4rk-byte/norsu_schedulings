'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  success?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, success, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const showSuccess = Boolean(success && !error)

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors dark:bg-gray-800 dark:text-white',
              'placeholder:text-stone-400 dark:placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                : 'border-stone-300 dark:border-gray-600',
              showSuccess && 'pr-10 border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500',
              className,
            )}
            {...props}
          />
          {showSuccess && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

export { Input }
export type { InputProps }
