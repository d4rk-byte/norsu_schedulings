'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  BookOpen,
  Clock,
  Users,
  FileText,
  Loader2,
  ArrowRight,
  GraduationCap,
  Calendar,
  UserCheck,
  GitPullRequest,
} from 'lucide-react'
import Badge from '@/components/ui/badge/Badge'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { facultyApi, type FacultyDashboardResponse } from '@/lib/faculty-api'
import { useAuth } from '@/contexts/AuthContext'

type ScheduleStatus = 'in-progress' | 'completed' | 'upcoming'

const scheduleStatusMeta: Record<ScheduleStatus, { label: string; color: 'success' | 'primary' | 'light' }> = {
  'in-progress': { label: 'In Progress', color: 'success' },
  upcoming: { label: 'Upcoming', color: 'primary' },
  completed: { label: 'Completed', color: 'light' },
}

export default function FacultyDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<FacultyDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingScheduleChangeCount, setPendingScheduleChangeCount] = useState(0)

  function getErrorMessage(err: unknown, fallback: string): string {
    const message =
      (err as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data?.message
      || (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message

    return typeof message === 'string' && message.trim() ? message : fallback
  }

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const response = await facultyApi.dashboard()
      setData(response)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error}</Alert>
        <Button type="button" variant="secondary" onClick={() => void loadDashboard()}>
          Retry
        </Button>
      </div>
    )
  }

  const stats = data?.stats
  const todaySchedules = data?.today_schedules ?? []
  const ay = data?.academic_year

  const periodLabel = ay
    ? `${ay.year}, ${ay.semester} Semester`
    : 'No active academic period'

  const displayName = user?.firstName?.trim() || user?.fullName?.trim() || 'Faculty'

  const statCards = [
    {
      label: 'Teaching Hours',
      value: stats?.total_hours ?? 0,
      icon: Clock,
      iconColor: 'text-brand-500',
      bg: 'bg-brand-500/10 dark:bg-brand-500/20',
      href: '/faculty/schedule',
      helper: 'Per week',
    },
    {
      label: 'Active Classes',
      value: stats?.active_classes ?? 0,
      icon: BookOpen,
      iconColor: 'text-success-500',
      bg: 'bg-success-500/10 dark:bg-success-500/20',
      href: '/faculty/classes',
      helper: 'Current term',
    },
    {
      label: 'Total Students',
      value: stats?.total_students ?? 0,
      icon: Users,
      iconColor: 'text-warning-500',
      bg: 'bg-warning-500/10 dark:bg-warning-500/20',
      href: '/faculty/classes',
      helper: 'Across classes',
    },
    {
      label: "Today's Classes",
      value: stats?.today_count ?? 0,
      icon: CalendarDays,
      iconColor: 'text-purple-500',
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
      href: '/faculty/schedule',
      helper: data?.today ?? 'Today',
    },
  ]

  const quickLinks = [
    { label: 'View Schedule', href: '/faculty/schedule', icon: CalendarDays, badge: undefined },
    {
      label: 'Request Schedule Change',
      href: '/faculty/schedule-change-requests',
      icon: GitPullRequest,
      badge: pendingScheduleChangeCount > 0
        ? pendingScheduleChangeCount > 99
          ? '99+'
          : pendingScheduleChangeCount
        : undefined,
    },
    { label: 'My Classes', href: '/faculty/classes', icon: BookOpen, badge: undefined },
    { label: 'My Profile', href: '/faculty/profile', icon: FileText, badge: undefined },
  ]

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  function parseTime(t?: string | null): number | null {
    if (!t) return null

    const [h, m] = t.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return null
    }

    return h * 60 + m
  }

  function getScheduleStatus(start?: string | null, end?: string | null): ScheduleStatus {
    const s = parseTime(start)
    const e = parseTime(end)

    if (s === null || e === null) {
      return 'upcoming'
    }

    if (currentMinutes >= s && currentMinutes < e) return 'in-progress'
    if (currentMinutes >= e) return 'completed'
    return 'upcoming'
  }

  const scheduleStatusOrder: Record<ScheduleStatus, number> = {
    'in-progress': 0,
    upcoming: 1,
    completed: 2,
  }

  const sortedTodaySchedules = [...todaySchedules].sort((a, b) => {
    const aStatus = getScheduleStatus(a.start_time, a.end_time)
    const bStatus = getScheduleStatus(b.start_time, b.end_time)

    const statusDiff = scheduleStatusOrder[aStatus] - scheduleStatusOrder[bStatus]
    if (statusDiff !== 0) {
      return statusDiff
    }

    const aStart = parseTime(a.start_time)
    const bStart = parseTime(b.start_time)

    if (aStart === null && bStart === null) return 0
    if (aStart === null) return 1
    if (bStart === null) return -1

    if (aStatus === 'completed') {
      return bStart - aStart
    }

    return aStart - bStart
  })

  let inProgressCount = 0
  let completedCount = 0

  todaySchedules.forEach((schedule) => {
    const status = getScheduleStatus(schedule.start_time, schedule.end_time)
    if (status === 'in-progress') inProgressCount += 1
    if (status === 'completed') completedCount += 1
  })

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white/90">
              Welcome back, {displayName}! 👋
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <GraduationCap className="shrink-0 mr-2 size-5 text-brand-500" />
                <span className="font-medium">Faculty Dashboard</span>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="shrink-0 mr-2 size-5 text-success-500" />
                {periodLabel}
              </div>
            </div>
          </div>
          <div className="mt-4 lg:mt-0 lg:ml-4">
            <Link
              href="/faculty/schedule"
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 shadow-sm hover:shadow-md transition-all"
            >
              <CalendarDays className="-ml-1 mr-2 size-5" />
              View Schedule
            </Link>
          </div>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 md:gap-6">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href} className="block">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 hover:shadow-theme-sm transition-shadow">
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 rounded-xl ${s.bg}`}>
                  <s.icon className={`size-5 lg:size-6 ${s.iconColor}`} />
                </div>
                <div className="ml-3 lg:ml-4 flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{s.label}</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-white/90">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-300 dark:text-gray-500" /> : s.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{s.helper}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Today&apos;s Schedule</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {todaySchedules.length} class{todaySchedules.length !== 1 ? 'es' : ''} today
              </p>
            </div>
            <Link
              href="/faculty/schedule"
              className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium transition-colors"
            >
              View Full
            </Link>
          </div>

          <div>
            {loading ? (
              <div className="space-y-3 lg:space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="h-12 w-14 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todaySchedules.length === 0 ? (
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-500 dark:text-gray-400">No classes scheduled for today.</p>
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-4">
                {sortedTodaySchedules.map((schedule) => {
                  const status = getScheduleStatus(schedule.start_time, schedule.end_time)
                  const statusMeta = scheduleStatusMeta[status]
                  const subjectCode = schedule.subject?.code ?? 'TBD'
                  const subjectTitle = schedule.subject?.title ?? 'Untitled Subject'
                  const roomCode = schedule.room?.code ?? 'TBA'
                  const roomName = schedule.room?.name ?? null
                  const section = schedule.section ?? '—'
                  const enrolledStudents = schedule.enrolled_students ?? 0
                  const startLabel = schedule.start_time_12h ?? 'TBA'
                  const endLabel = schedule.end_time_12h ?? 'TBA'

                  return (
                    <div key={schedule.id} className="flex items-center gap-3 lg:gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors">
                      <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg text-xs font-semibold shrink-0
                        ${status === 'in-progress' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : status === 'completed' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'}`}>
                        <span>{startLabel}</span>
                        <span className="text-[11px]">{endLabel}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90 truncate">{subjectCode} - {subjectTitle}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {schedule.day_pattern_label} | Room {roomCode}{roomName ? ` (${roomName})` : ''} | Section {section} | {enrolledStudents} students
                        </p>
                      </div>
                      <Badge size="sm" color={statusMeta.color}>{statusMeta.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Quick Actions</h3>
            <div className="space-y-2 lg:space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full flex items-center justify-between gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-white/5 dark:hover:border-gray-600 transition-all group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <link.icon className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                    {link.label}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {link.badge != null && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                        {link.badge}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300" />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Faculty Snapshot</h3>
            <ul className="space-y-3">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><Clock className="h-4 w-4" /> Semester</span>
                <Badge size="sm" color="primary">{ay?.semester ?? '—'}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><BookOpen className="h-4 w-4" /> Active Classes</span>
                <Badge size="sm" color="success">{stats?.active_classes ?? 0}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><Users className="h-4 w-4" /> Students</span>
                <Badge size="sm" color="info">{stats?.total_students ?? 0}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><UserCheck className="h-4 w-4" /> In Progress</span>
                <Badge size="sm" color="warning">{inProgressCount}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><CalendarDays className="h-4 w-4" /> Completed</span>
                <Badge size="sm" color="light">{completedCount}</Badge>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
