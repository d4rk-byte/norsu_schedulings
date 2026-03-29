'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import {
  GridIcon,
  CalenderIcon,
  TaskIcon,
  GroupIcon,
  TableIcon,
  PageIcon,
  HorizontaLDots,
} from '@/icons/index'
import { facultyApi } from '@/lib/faculty-api'

type FacultyNavItem = {
  name: string
  path: string
  icon: React.ReactNode
  badge?: number
}

type FacultyNavSection = {
  title: string
  items: FacultyNavItem[]
}

export function FacultySidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar()
  const pathname = usePathname()
  const [pendingScheduleChangeCount, setPendingScheduleChangeCount] = useState(0)

  useEffect(() => {
    let mounted = true

    const loadPendingScheduleChangeCount = async () => {
      try {
        const pendingRequests = await facultyApi.listScheduleChangeRequests({
          status: 'pending',
          limit: 100,
        })

        if (!mounted) return
        setPendingScheduleChangeCount(pendingRequests.length)
      } catch {
        if (!mounted) return
        setPendingScheduleChangeCount(0)
      }
    }

    void loadPendingScheduleChangeCount()

    const intervalId = window.setInterval(() => {
      void loadPendingScheduleChangeCount()
    }, 60000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const sections: FacultyNavSection[] = [
    {
      title: 'Menu',
      items: [
        { name: 'Dashboard', path: '/faculty/dashboard', icon: <GridIcon /> },
      ],
    },
    {
      title: 'My Schedule',
      items: [
        { name: 'Teaching Schedule', path: '/faculty/schedule', icon: <CalenderIcon /> },
        {
          name: 'Schedule Change Requests',
          path: '/faculty/schedule-change-requests',
          icon: <TaskIcon />,
          badge: pendingScheduleChangeCount,
        },
      ],
    },
    {
      title: 'My Classes',
      items: [
        { name: 'Current Classes', path: '/faculty/classes', icon: <GroupIcon /> },
      ],
    },
    {
      title: 'Academic',
      items: [
        { name: 'Department', path: '/faculty/department', icon: <TableIcon /> },
      ],
    },
    {
      title: 'System',
      items: [
        { name: 'Profile', path: '/faculty/profile', icon: <PageIcon /> },
      ],
    },
  ]

  const isCollapsed = !isExpanded && !isHovered && !isMobileOpen
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${
        isExpanded || isMobileOpen
          ? 'w-[290px]'
          : isHovered
            ? 'w-[290px]'
            : 'w-[90px]'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${isCollapsed ? 'lg:justify-center' : 'justify-start'}`}>
        <Link href="/faculty/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
            <Image
              src="/images/logo/norsu.png"
              alt="Negros Oriental State University seal"
              width={32}
              height={32}
              className="h-10 w-10 object-contain"
            />
          </div>
          {(isExpanded || isHovered || isMobileOpen) && (
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-white/90">NORSU</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scheduling System</p>
            </div>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-3">
            {sections.map((section) => (
              <div key={section.title}>
                <h2
                  className={`mb-3 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    isCollapsed ? 'lg:justify-center' : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? section.title : <HorizontaLDots />}
                </h2>

                <ul className="flex flex-col gap-2">
                  {section.items.map((item) => {
                    const active = isActive(item.path)
                    const showBadge = item.path === '/faculty/schedule-change-requests' && (item.badge ?? 0) > 0

                    return (
                      <li key={item.path}>
                        <Link
                          href={item.path}
                          className={`menu-item group ${active ? 'menu-item-active' : 'menu-item-inactive'} ${
                            isCollapsed ? 'lg:justify-center' : 'lg:justify-start'
                          }`}
                        >
                          <span className={active ? 'menu-item-icon-active' : 'menu-item-icon-inactive'}>
                            {item.icon}
                          </span>

                          {(isExpanded || isHovered || isMobileOpen) && (
                            <span className="menu-item-text truncate">{item.name}</span>
                          )}

                          {(isExpanded || isHovered || isMobileOpen) && showBadge && (
                            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                              {item.badge! > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  )
}
