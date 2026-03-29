'use client'

import { useEffect, useRef } from 'react'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'

interface DatePickerProps {
  label?: string
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  id?: string
  minDate?: string
  maxDate?: string
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
  required,
  id,
  minDate,
  maxDate,
}: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fpRef = useRef<flatpickr.Instance | null>(null)
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  useEffect(() => {
    if (!inputRef.current) return

    fpRef.current = flatpickr(inputRef.current, {
      dateFormat: 'Y-m-d',
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      maxDate: maxDate || undefined,
      monthSelectorType: 'static',
      static: true,
      onChange: (_, dateStr) => {
        onChange?.(dateStr)
      },
    })

    return () => {
      fpRef.current?.destroy()
    }
    // Only re-init when min/max constraints change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, maxDate])

  // Sync external value changes without re-creating the instance
  useEffect(() => {
    if (fpRef.current) {
      const currentVal = fpRef.current.selectedDates[0]
      const currentStr = currentVal ? fpRef.current.formatDate(currentVal, 'Y-m-d') : ''
      if (currentStr !== (value || '')) {
        fpRef.current.setDate(value || '', false)
      }
    }
  }, [value])

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          placeholder={placeholder}
          readOnly
          className={cn(
            'block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm shadow-sm transition-colors cursor-pointer',
            'placeholder:text-stone-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-stone-300 dark:border-gray-600',
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 dark:text-gray-500">
          <Calendar className="h-4 w-4" />
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
