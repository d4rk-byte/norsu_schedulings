'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string | number
  color?: string
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

interface SidebarNavProps {
  sections: NavSection[]
}

export function SidebarNav({ sections }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          {section.title && (
            <p className="px-3 mb-2 text-xs font-semibold text-stone-400 dark:text-gray-500 uppercase tracking-wider">
              {section.title}
            </p>
          )}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-l-4 border-primary-600'
                        : 'text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-800 hover:text-stone-900 dark:hover:text-white border-l-4 border-transparent',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 flex-shrink-0',
                        isActive ? 'text-primary-600' : (item.color || 'text-stone-400'),
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null && (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium',
                          isActive ? 'bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200' : 'bg-stone-200 dark:bg-gray-700 text-stone-600 dark:text-gray-300',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

interface SidebarShellProps {
  children: ReactNode
  brandTitle?: string
  brandSubtitle?: string
  brandIconSrc?: string
  brandIconAlt?: string
}

export function SidebarShell({
  children,
  brandTitle = 'NORSU',
  brandSubtitle = 'Scheduling System',
  brandIconSrc,
  brandIconAlt = 'Brand logo',
}: SidebarShellProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-white dark:bg-gray-800 border-r border-stone-200 dark:border-gray-700 shadow-sm h-screen sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-stone-100 dark:border-gray-700">
        {brandIconSrc ? (
          <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
            <Image src={brandIconSrc} alt={brandIconAlt} width={40} height={40} className="h-10 w-10 object-contain" />
          </div>
        ) : (
          <div className="h-10 w-10 rounded-lg bg-primary-700 dark:bg-primary-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">N</span>
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-stone-900 dark:text-white">{brandTitle}</p>
          <p className="text-xs text-stone-500 dark:text-gray-400">{brandSubtitle}</p>
        </div>
      </div>

      {children}
    </aside>
  )
}

// Mobile sidebar wrapper
interface MobileSidebarProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function MobileSidebar({ open, onClose, children }: MobileSidebarProps) {
  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300">
        {children}
      </div>
    </div>
  )
}
