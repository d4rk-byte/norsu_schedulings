'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Building2,
  CalendarRange,
  DoorOpen,
  BookOpen,
  GraduationCap,
  ArrowRight,
  Clock,
  UserCheck,
  Shield,
  Wifi,
  FileText,
  Calendar,
} from 'lucide-react'
import Badge from '@/components/ui/badge/Badge'
import { GroupIcon, ArrowUpIcon, ArrowDownIcon } from '@/icons'
import { adminDashboard } from '@/lib/admin-api'
import { useAuth } from '@/contexts/AuthContext'

/* ------------------------------------------------------------------ */
/*  Helper: format relative time                                       */
/* ------------------------------------------------------------------ */
function timeAgo(dateStr: string) {
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return 'Just now'

  const diff = Date.now() - parsed.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function humanizeAction(action: string) {
  if (!action) return 'Activity'

  return action
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/* ------------------------------------------------------------------ */
/*  Quick-action links (same as Twig version)                          */
/* ------------------------------------------------------------------ */
const quickLinks = [
  { label: 'Manage Users', href: '/admin/users', icon: Users, color: 'text-brand-500' },
  { label: 'Manage Colleges', href: '/admin/colleges', icon: GraduationCap, color: 'text-purple-500' },
  { label: 'Manage Curricula', href: '/admin/curricula', icon: BookOpen, color: 'text-orange-500' },
  { label: 'Academic Years', href: '/admin/academic-years', icon: Calendar, color: 'text-brand-500' },
  { label: 'Manage Subjects', href: '/admin/subjects', icon: FileText, color: 'text-teal-500' },
  { label: 'Room Management', href: '/admin/rooms', icon: DoorOpen, color: 'text-success-500' },
  { label: 'View Reports', href: '/admin/reports/faculty-workload', icon: CalendarRange, color: 'text-indigo-500' },
]

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */
export default function AdminDashboard() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: adminDashboard.stats,
    retry: 1,
    refetchInterval: 30000, // auto-refresh every 30 seconds
  })

  return (
    <div className="space-y-6">
      {/* ── Page Header (matches Twig) ── */}
      <div className="mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white/90">
              Welcome back, {user?.firstName ?? 'Admin'}! 👋
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Shield className="shrink-0 mr-2 size-5 text-brand-500" />
                <span className="font-medium">System Administrator Access</span>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Clock className="shrink-0 mr-2 size-5 text-success-500" />
                Last login: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
          <div className="mt-4 lg:mt-0 lg:ml-4">
            <Link
              href="/admin/users"
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 shadow-sm hover:shadow-md transition-all"
            >
              <Users className="-ml-1 mr-2 size-5" />
              Manage Users
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats Grid (3 cards like Twig) ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {/* Total Users */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6 hover:shadow-theme-sm transition-shadow">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-brand-500/10 dark:bg-brand-500/20">
              <GroupIcon className="size-5 lg:size-6 text-brand-500" />
            </div>
            <div className="ml-3 lg:ml-4 flex-1 min-w-0">
              <p className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Users</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-white/90">
                {isLoading ? '—' : stats?.totalUsers ?? 0}
              </p>
              {!isLoading && stats?.growthPercent !== undefined && stats.growthPercent !== 0 ? (
                <p className={`text-xs flex items-center mt-1 ${stats.growthPercent > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                  {stats.growthPercent > 0
                    ? <ArrowUpIcon className="size-3 mr-1" />
                    : <ArrowDownIcon className="size-3 mr-1" />}
                  {stats.growthPercent > 0 ? '+' : ''}{stats.growthPercent}% this month
                </p>
              ) : !isLoading ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No change this month</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Total Rooms */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6 hover:shadow-theme-sm transition-shadow">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-success-500/10 dark:bg-success-500/20">
              <DoorOpen className="size-5 lg:size-6 text-success-500" />
            </div>
            <div className="ml-3 lg:ml-4 flex-1 min-w-0">
              <p className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Rooms</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-white/90">
                {isLoading ? '—' : stats?.totalRooms ?? 0}
              </p>
              {!isLoading && (
                <p className="text-xs text-success-600 dark:text-success-400 flex items-center mt-1">
                  <span className="w-2 h-2 bg-success-500 rounded-full mr-2" />
                  {stats?.availableRooms ?? 0} available
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6 hover:shadow-theme-sm transition-shadow">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20">
              <Wifi className="size-5 lg:size-6 text-purple-500" />
            </div>
            <div className="ml-3 lg:ml-4 flex-1 min-w-0">
              <p className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Users</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-white/90">
                {isLoading ? '—' : stats?.activeUsers ?? 0}
              </p>
              {!isLoading && (
                <p className="text-xs text-brand-500 dark:text-brand-400 flex items-center mt-1">
                  <span className="w-2 h-2 bg-brand-500 rounded-full mr-2" />
                  Online now
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity (left 2/3) */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Recent Activity
            </h3>
            <Link
              href="/admin/activity-logs"
              className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium transition-colors"
            >
              View All
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 lg:space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentActivities?.length ? (
            <div className="space-y-3 lg:space-y-4">
              {stats.recentActivities.slice(0, 8).map((act) => (
                <div key={act.id} className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-500/20 shrink-0">
                    <UserCheck className="size-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                      {humanizeAction(act.action)}
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {act.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        by {act.user?.fullName || 'System'}
                      </p>
                      {act.user?.roleDisplayName ? (
                        <Badge size="sm" color="info">
                          {act.user.roleDisplayName}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {timeAgo(act.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success-100 dark:bg-success-500/20 shrink-0">
                <Shield className="size-4 text-success-600 dark:text-success-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">System initialized</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Smart Scheduling System is ready for use</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Today</p>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: Quick Actions + User Breakdown */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2 lg:space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-white/5 dark:hover:border-gray-600 transition-all"
                >
                  <link.icon className={`size-4 lg:size-5 shrink-0 ${link.color}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* User Role Breakdown (same as Twig) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              User Breakdown
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-error-500 rounded-full mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Administrators</span>
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {isLoading ? '—' : stats?.totalAdmins ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-warning-500 rounded-full mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Department Heads</span>
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {isLoading ? '—' : stats?.totalDepartmentHeads ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-success-500 rounded-full mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Faculty Members</span>
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {isLoading ? '—' : stats?.totalFaculty ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
