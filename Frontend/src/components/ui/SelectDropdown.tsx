'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectDropdownOption {
  value: string
  label: string
}

interface SelectDropdownProps {
  label?: string
  error?: string
  required?: boolean
  value: string
  onChange: (value: string) => void
  options: SelectDropdownOption[]
  placeholder?: string
  searchable?: boolean
  className?: string
}

export function SelectDropdown({
  label,
  error,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  className,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus search when opened
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open, searchable])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]')
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
    setSearch('')
    setHighlightIndex(-1)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex].value)
        }
        break
      case 'Escape':
        setOpen(false)
        setSearch('')
        setHighlightIndex(-1)
        break
    }
  }

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors text-left',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error ? 'border-red-400' : 'border-stone-300 dark:border-gray-600',
            selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
            'dark:bg-gray-800',
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown className={cn('h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0 ml-2 transition-transform', open && 'rotate-180')} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 flex flex-col overflow-hidden">
            {searchable && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 dark:border-gray-700">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setHighlightIndex(-1)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  className="w-full text-sm bg-transparent text-gray-800 dark:text-gray-100 outline-none placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            )}
            <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '13rem' }}>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No results found</div>
              ) : (
                filtered.map((opt, idx) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-option
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      opt.value === value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300',
                      idx === highlightIndex && 'bg-gray-100 dark:bg-gray-700',
                      opt.value !== value && idx !== highlightIndex && 'hover:bg-gray-50 dark:hover:bg-gray-700/70',
                    )}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
