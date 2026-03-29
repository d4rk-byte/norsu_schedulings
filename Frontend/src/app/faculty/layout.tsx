'use client'

import { type ReactNode } from 'react'
import { useSidebar } from '@/context/SidebarContext'
import { FacultySidebar } from '@/components/layout/FacultySidebar'
import AppHeader from '@/layout/AppHeader'
import Backdrop from '@/layout/Backdrop'
import { FacultyProfileCompletionGate } from '@/components/auth/FacultyProfileCompletionGate'

export default function FacultyLayout({ children }: { children: ReactNode }) {
  const { isExpanded, isHovered } = useSidebar()

  const mainContentMargin = isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]'

  return (
    <div className="min-h-screen xl:flex dark:bg-gray-900">
      <FacultySidebar />
      <Backdrop />

      <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
        <AppHeader semesterApiPrefix="/api/faculty" />
        <main id="main-content" className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          {children}
        </main>
      </div>

      <FacultyProfileCompletionGate />
    </div>
  )
}
