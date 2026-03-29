'use client'

import React, { type ReactNode } from 'react'
import { useSidebar } from '@/context/SidebarContext'
import AppHeader from '@/layout/AppHeader'
import AdminSidebar from '@/layout/AdminSidebar'
import Backdrop from '@/layout/Backdrop'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
    ? 'lg:ml-[290px]'
    : 'lg:ml-[90px]'

  return (
    <div className="min-h-screen xl:flex dark:bg-gray-900">
      <AdminSidebar />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
        <AppHeader />
        <main id="main-content" className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
