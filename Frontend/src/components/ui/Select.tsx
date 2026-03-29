'use client'

import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string | number
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors dark:bg-gray-800 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-stone-300 dark:border-gray-600',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'

export { Select }
export type { SelectProps, SelectOption }
