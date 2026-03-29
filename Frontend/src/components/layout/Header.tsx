'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, Search, Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, ROLE_PROFILE_PATHS } from '@/lib/constants'
import Link from 'next/link'

interface HeaderProps {
  onMenuClick: () => void
  semesterLabel?: string
}

export function Header({ onMenuClick, semesterLabel }: HeaderProps) {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fullName = user ? `${user.firstName} ${user.lastName}` : ''
  const roleLabel = user ? ROLE_LABELS[user.role] ?? 'User' : ''
  const profilePath = user ? (ROLE_PROFILE_PATHS[user.role] || '/profile') : '/profile'

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-stone-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: hamburger + search */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-stone-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search (hidden on small) */}
          <div className="hidden md:block relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              aria-label="Search"
              className="w-64 rounded-lg border border-stone-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white pl-10 pr-4 py-2 text-sm placeholder:text-stone-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Right: semester badge + notifications + user menu */}
        <div className="flex items-center gap-3">
          {/* Semester badge */}
          {semesterLabel && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-accent-50 text-accent-700 rounded-full text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              {semesterLabel}
            </div>
          )}

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex items-center justify-center p-2 rounded-lg text-stone-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700"
          >
            <Bell className="h-5 w-5" />
            {/* Unread indicator */}
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Avatar name={fullName} size="sm" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-stone-900 dark:text-white leading-none">{fullName}</p>
                <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{roleLabel}</p>
              </div>
              <ChevronDown className="hidden md:block h-4 w-4 text-stone-400 dark:text-gray-500" />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-stone-200 dark:border-gray-700 py-1 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-stone-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-stone-900 dark:text-white">{fullName}</p>
                  <p className="text-xs text-stone-500 dark:text-gray-400">{roleLabel}</p>
                </div>

                <Link
                  href={profilePath}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700"
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>

                <div className="border-t border-stone-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false)
                      logout()
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export type { HeaderProps }
