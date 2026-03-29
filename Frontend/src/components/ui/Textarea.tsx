'use client'

import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors dark:bg-gray-800 dark:text-white',
            'placeholder:text-stone-400 dark:placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-stone-300 dark:border-gray-600',
            className,
          )}
          rows={4}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'

export { Textarea }
export type { TextareaProps }
