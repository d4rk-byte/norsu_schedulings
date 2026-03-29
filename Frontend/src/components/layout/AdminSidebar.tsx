'use client'

import {
  LayoutDashboard,
  Users,
  UserCog,
  UserCheck,
  GraduationCap,
  Building2,
  DoorOpen,
  Building,
  FolderTree,
  BookOpen,
  BookMarked,
  CalendarDays,
  CalendarRange,
  Weight,
  History,
  BarChart3,
  PieChart,
} from 'lucide-react'
import { SidebarNav, SidebarShell, type NavSection } from './SidebarNav'

const adminSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, color: 'text-primary-500' },
    ],
  },
  {
    title: 'User Management',
    items: [
      { label: 'All Users', href: '/admin/users', icon: Users, color: 'text-purple-500' },
      { label: 'Administrators', href: '/admin/users/administrators', icon: UserCog, color: 'text-red-500' },
      { label: 'Department Heads', href: '/admin/users/department-heads', icon: UserCheck, color: 'text-yellow-500' },
      { label: 'Faculty Members', href: '/admin/users/faculty', icon: GraduationCap, color: 'text-green-500' },
    ],
  },
  {
    title: 'Academic Management',
    items: [
      { label: 'Colleges', href: '/admin/colleges', icon: Building2, color: 'text-primary-500' },
      { label: 'Rooms', href: '/admin/rooms', icon: DoorOpen, color: 'text-green-500' },
      { label: 'Departments', href: '/admin/departments', icon: Building, color: 'text-purple-500' },
      { label: 'Department Groups', href: '/admin/department-groups', icon: FolderTree, color: 'text-indigo-500' },
      { label: 'Curricula', href: '/admin/curricula', icon: BookOpen, color: 'text-orange-500' },
      { label: 'Subjects', href: '/admin/subjects', icon: BookMarked, color: 'text-primary-500' },
    ],
  },
  {
    title: 'Schedule Management',
    items: [
      { label: 'Academic Years', href: '/admin/academic-years', icon: CalendarDays, color: 'text-primary-500' },
      { label: 'Schedules', href: '/admin/schedules', icon: CalendarRange, color: 'text-primary-500' },
      { label: 'Faculty Loading', href: '/admin/faculty-loading', icon: Weight, color: 'text-purple-500' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'History & Reports', href: '/admin/history', icon: History, color: 'text-teal-500' },
      { label: 'Faculty Workload', href: '/admin/reports/faculty-workload', icon: BarChart3, color: 'text-teal-500' },
      { label: 'Room Utilization', href: '/admin/reports/room-utilization', icon: PieChart, color: 'text-teal-500' },
    ],
  },
]

export function AdminSidebar() {
  return (
    <SidebarShell
      brandIconSrc="/images/logo/norsu.png"
      brandIconAlt="Negros Oriental State University seal"
    >
      <SidebarNav sections={adminSections} />
    </SidebarShell>
  )
}

// Also export sections for mobile sidebar reuse
export { adminSections }
