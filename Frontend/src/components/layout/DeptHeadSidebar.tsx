'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import {
  GridIcon,
  ChevronDownIcon,
  HorizontaLDots,
  UserCircleIcon,
  TableIcon,
  CalenderIcon,
  PieChartIcon,
  PageIcon,
} from '@/icons/index'
import { dhScheduleChangeRequestsApi } from '@/lib/department-head-api'

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  subItems?: { name: string; path: string }[]
}

type SubmenuState = {
  type: 'main' | 'others'
  index: number
}

type SubmenuPreference = SubmenuState | 'none' | null

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: 'Dashboard',
    path: '/department-head/dashboard',
  },
  {
    name: 'Department Mgmt',
    icon: <UserCircleIcon />,
    subItems: [
      { name: 'Faculty Members', path: '/department-head/faculty' },
      { name: 'Department Info', path: '/department-head/department-info' },
      { name: 'Curriculum Management', path: '/department-head/curricula' },
      { name: 'Room Management', path: '/department-head/rooms' },
    ],
  },
  {
    name: 'Schedule Mgmt',
    icon: <CalenderIcon />,
    subItems: [
      { name: 'Department Schedules', path: '/department-head/schedules' },
      { name: 'Schedule Change Requests', path: '/department-head/schedule-change-requests' },
      { name: 'Faculty Assignments', path: '/department-head/faculty-assignments' },
    ],
  },
]

const othersItems: NavItem[] = [
  {
    name: 'Reports & Analytics',
    icon: <PieChartIcon />,
    subItems: [
      { name: 'Faculty Workload', path: '/department-head/reports/faculty-workload' },
      { name: 'History & Reports', path: '/department-head/reports/history' },
      { name: 'Room Utilization', path: '/department-head/reports/room-utilization' },
      { name: 'Activity Logs', path: '/department-head/activity-logs' },
    ],
  },
]

const systemItems: NavItem[] = [
  {
    icon: <TableIcon />,
    name: 'Settings',
    path: '/department-head/settings',
  },
  {
    icon: <PageIcon />,
    name: 'Profile',
    path: '/department-head/profile',
  },
]

export function DeptHeadSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar()
  const pathname = usePathname()
  const [pendingScheduleChangeCount, setPendingScheduleChangeCount] = useState(0)
  const isMountedRef = useRef(true)

  const loadPendingScheduleChangeCount = useCallback(async () => {
    try {
      const pendingRequests = await dhScheduleChangeRequestsApi.list({
        status: 'pending',
        department_head_status: 'pending',
        limit: 100,
      })

      if (!isMountedRef.current) return
      setPendingScheduleChangeCount(pendingRequests.length)
    } catch {
      if (!isMountedRef.current) return
      setPendingScheduleChangeCount(0)
    }
  }, [])

  const [openSubmenuPreference, setOpenSubmenuPreference] = useState<{
    pathname: string
    value: SubmenuPreference
  }>({
    pathname,
    value: null,
  })
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({})
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const isActive = useCallback(
    (path: string) => pathname === path || pathname.startsWith(path + '/'),
    [pathname],
  )

  const activeSubmenu: SubmenuState | null = (() => {
    const menuGroups: Array<{ type: 'main' | 'others'; items: NavItem[] }> = [
      { type: 'main', items: navItems },
      { type: 'others', items: othersItems },
    ]

    for (const group of menuGroups) {
      const index = group.items.findIndex((item) =>
        item.subItems?.some((subItem) => isActive(subItem.path)),
      )

      if (index !== -1) {
        return { type: group.type, index }
      }
    }

    return null
  })()

  const openSubmenu: SubmenuState | null = (() => {
    const currentPreference =
      openSubmenuPreference.pathname === pathname
        ? openSubmenuPreference.value
        : null

    if (currentPreference === 'none') {
      return null
    }

    if (currentPreference) {
      return currentPreference
    }

    return activeSubmenu
  })()

  const openSubmenuType = openSubmenu?.type ?? null
  const openSubmenuIndex = openSubmenu?.index ?? null

  useEffect(() => {
    const refreshPendingScheduleChangeCount = async () => {
      await loadPendingScheduleChangeCount()
    }

    const handleRequestsUpdated = () => {
      void refreshPendingScheduleChangeCount()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshPendingScheduleChangeCount()
      }
    }

    void refreshPendingScheduleChangeCount()

    const intervalId = window.setInterval(() => {
      void refreshPendingScheduleChangeCount()
    }, 60000)

    window.addEventListener('focus', handleRequestsUpdated)
    window.addEventListener('dh-schedule-change-requests-updated', handleRequestsUpdated)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMountedRef.current = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleRequestsUpdated)
      window.removeEventListener('dh-schedule-change-requests-updated', handleRequestsUpdated)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadPendingScheduleChangeCount])

  useEffect(() => {
    if (openSubmenuType !== null && openSubmenuIndex !== null) {
      const key = `${openSubmenuType}-${openSubmenuIndex}`
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }))
      }
    }
  }, [openSubmenuType, openSubmenuIndex])

  const handleSubmenuToggle = (index: number, menuType: 'main' | 'others') => {
    setOpenSubmenuPreference((prev) => {
      const currentPreference = prev.pathname === pathname ? prev.value : null

      if (
        currentPreference &&
        currentPreference !== 'none' &&
        currentPreference.type === menuType &&
        currentPreference.index === index
      ) {
        return { pathname, value: 'none' }
      }

      return { pathname, value: { type: menuType, index } }
    })
  }

  const renderMenuItems = (items: NavItem[], menuType: 'main' | 'others') => (
    <ul className="flex flex-col gap-2">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? 'menu-item-active'
                  : 'menu-item-inactive'
              } cursor-pointer ${
                !isExpanded && !isHovered ? 'lg:justify-center' : 'lg:justify-start'
              }`}
            >
              <span
                className={`${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? 'menu-item-icon-active'
                    : 'menu-item-icon-inactive'
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text truncate">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? 'rotate-180 text-brand-500'
                      : ''
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? 'menu-item-active' : 'menu-item-inactive'
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path) ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text truncate">{nav.name}</span>
                )}
              </Link>
            )
          )}

          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : '0px',
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => {
                  const pendingCount =
                    subItem.path === '/department-head/schedule-change-requests'
                      ? pendingScheduleChangeCount
                      : 0

                  return (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? 'menu-dropdown-item-active'
                            : 'menu-dropdown-item-inactive'
                        } flex items-center justify-between gap-2`}
                      >
                        <span className="truncate">{subItem.name}</span>
                        {pendingCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  )

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? 'w-[290px]'
            : isHovered
              ? 'w-[290px]'
              : 'w-[90px]'
        }
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'}`}>
        <Link href="/department-head/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center shrink-0">
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
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? 'Menu' : <HorizontaLDots />}
              </h2>
              {renderMenuItems(navItems, 'main')}
            </div>
            <div>
              <h2
                className={`mb-3 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? 'Analytics' : <HorizontaLDots />}
              </h2>
              {renderMenuItems(othersItems, 'others')}
            </div>
            <div>
              <h2
                className={`mb-3 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? 'System' : <HorizontaLDots />}
              </h2>
              {renderMenuItems(systemItems, 'others')}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}

