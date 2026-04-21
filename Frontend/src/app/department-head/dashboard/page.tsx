'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  CalendarRange,
  BookOpen,
  DoorOpen,
  ArrowRight,
  Clock,
  UserCheck,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { dhDashboard, dhSettingsApi, type DeptHeadDashboardStats } from '@/lib/department-head-api'
import { useAcademicYearFilter } from '@/hooks/useAcademicYearFilter'

const quickLinks = [
  { label: 'Faculty Members', href: '/department-head/faculty', icon: Users },
  { label: 'Schedules', href: '/department-head/schedules', icon: CalendarRange },
  { label: 'Faculty Assignments', href: '/department-head/faculty-assignments', icon: UserCheck },
  { label: 'Faculty Workload Report', href: '/department-head/reports/faculty-workload', icon: BarChart3 },
]

export default function DeptHeadDashboard() {
  const ayFilter = useAcademicYearFilter('/api/department-head')
  const [stats, setStats] = useState<DeptHeadDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isInitialLoading = loading && !stats
  const isRefreshing = loading && !!stats

  const currentFilterLabel = ayFilter.currentLabel !== 'All Periods'
    ? ayFilter.currentLabel
    : 'System-wide Active Period'

  useEffect(() => {
    let active = true

    async function syncSystemPeriod() {
      try {
        const settings = await dhSettingsApi.get()
        if (!active) return

        const currentAy = settings.currentAcademicYear as { id?: number } | null | undefined
        const nextAyId = currentAy?.id ? String(currentAy.id) : ''
        const activeSemester = typeof settings.activeSemester === 'string' ? settings.activeSemester : ''

        if (ayFilter.selectedAyId !== nextAyId) {
          ayFilter.setSelectedAyId(nextAyId)
        }

        if (ayFilter.selectedSemester !== activeSemester) {
          ayFilter.setSelectedSemester(activeSemester)
        }
      } catch {
        // Keep last known values if settings fetch fails.
      }
    }

    syncSystemPeriod()
    const timer = setInterval(syncSystemPeriod, 15000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [
    ayFilter.selectedAyId,
    ayFilter.selectedSemester,
    ayFilter.setSelectedAyId,
    ayFilter.setSelectedSemester,
  ])

  useEffect(() => {
    let active = true

    setLoading(true)
    setError('')

    dhDashboard.stats({
      academic_year_id: ayFilter.selectedAyId || undefined,
      semester: ayFilter.selectedSemester || undefined,
    })
      .then((nextStats) => {
        if (!active) return
        setStats(nextStats)
      })
      .catch(() => {
        if (!active) return
        setError('Failed to load dashboard data')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester])

  const statCards = [
    { label: 'Faculty Members', value: stats?.totalFaculty ?? '—', icon: Users, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/15', href: '/department-head/faculty' },
    { label: 'Department Schedules', value: stats?.totalSchedules ?? '—', icon: CalendarRange, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/15', href: '/department-head/schedules' },
    { label: 'Curricula', value: stats?.totalCurricula ?? '—', icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/15', href: '/department-head/curricula' },
    { label: 'Rooms', value: stats?.totalRooms ?? '—', icon: DoorOpen, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/15', href: '/department-head/rooms' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Department Head Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your department at a glance</p>
        <div className="mt-3 inline-flex min-h-8 items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 rounded-full text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
          <span>{currentFilterLabel}</span>
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          </span>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`${s.bg} p-3 rounded-lg`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{s.label}</p>
                  <div className="min-h-8 min-w-13 flex items-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {isInitialLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-300 dark:text-gray-500" /> : s.value}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Conflicts alert */}
      <div className="min-h-21">
        {isInitialLoading ? (
          <Alert variant="info" title="Checking schedule conflicts">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading latest conflict status.
            </span>
          </Alert>
        ) : (stats?.conflicts ?? 0) > 0 ? (
          <Alert variant="warning" title={`${stats?.conflicts} Schedule Conflict${(stats?.conflicts ?? 0) > 1 ? 's' : ''} Detected`}>
            <Link href="/department-head/schedules" className="underline font-medium">View schedules</Link> to resolve conflicts.
          </Alert>
        ) : (
          <Alert variant="success" title="No schedule conflicts detected">
            Department schedules are currently conflict-free for this period.
          </Alert>
        )}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Faculty Workloads */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Faculty Workloads" description="Top faculty by teaching load" action={<Link href="/department-head/reports/faculty-workload" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">View All</Link>} />
            <div className="min-h-52">
              {isInitialLoading ? (
                <div className="space-y-3" aria-hidden="true">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="grid grid-cols-[minmax(0,1fr)_8.5rem_3rem_7.5rem] items-center gap-3 animate-pulse">
                      <div className="space-y-1.5 min-w-0">
                        <div className="h-3.5 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700/60" />
                      <div className="h-3 w-8 justify-self-end rounded bg-gray-100 dark:bg-gray-800" />
                      <div className="h-5 w-full rounded bg-gray-100 dark:bg-gray-700/60" />
                    </div>
                  ))}
                </div>
              ) : stats?.facultyWorkloads && stats.facultyWorkloads.length > 0 ? (
                <div className="space-y-3">
                  {stats.facultyWorkloads.map((fw) => (
                    <div key={fw.id} className="grid grid-cols-[minmax(0,1fr)_8.5rem_3rem_7.5rem] items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{fw.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{fw.units} units</p>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700/60 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${fw.percentage > 100 ? 'bg-red-500' : fw.percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(fw.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-right tabular-nums">{fw.percentage}%</span>
                      <Badge variant={fw.status === 'Overloaded' ? 'danger' : fw.status === 'Underloaded' ? 'warning' : 'success'} className="text-xs w-full justify-center whitespace-nowrap">
                        {fw.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No workload data available</p>
              )}
            </div>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader
              title="Recent Activity"
              description="Latest changes in your department"
              action={<Link href="/department-head/activity-logs" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">View All</Link>}
            />
            <div className="min-h-52">
              {isInitialLoading ? (
                <div className="space-y-3" aria-hidden="true">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex items-start gap-3 py-1 animate-pulse">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="h-3.5 w-11/12 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-3 w-2/5 rounded bg-gray-100 dark:bg-gray-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentActivities && stats.recentActivities.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {stats.recentActivities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 py-3">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{a.description}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(a.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No recent activity</p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    <link.icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    {link.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Department Status" />
            <div className="min-h-36">
              {isInitialLoading ? (
                <div className="space-y-3" aria-hidden="true">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex items-center justify-between animate-pulse">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-5 w-12 rounded bg-gray-100 dark:bg-gray-700/60" />
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><UserCheck className="h-4 w-4" /> Active Faculty</span>
                    <Badge variant="success" className="min-w-12 justify-center tabular-nums">{stats?.activeFaculty ?? 0}</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><AlertTriangle className="h-4 w-4" /> Inactive Faculty</span>
                    <Badge variant={stats?.inactiveFaculty ? 'warning' : 'default'} className="min-w-12 justify-center tabular-nums">{stats?.inactiveFaculty ?? 0}</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><AlertCircle className="h-4 w-4" /> Conflicts</span>
                    <Badge variant={stats?.conflicts ? 'danger' : 'success'} className="min-w-12 justify-center tabular-nums">{stats?.conflicts ?? 0}</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><DoorOpen className="h-4 w-4" /> Room Utilization</span>
                    <Badge variant="primary" className="min-w-14 justify-center tabular-nums">{`${stats?.roomUtilization ?? 0}%`}</Badge>
                  </li>
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Schedule Status" />
            <div className="min-h-36">
              {isInitialLoading ? (
                <div className="space-y-2" aria-hidden="true">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex items-center justify-between animate-pulse">
                      <div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-5 w-12 rounded bg-gray-100 dark:bg-gray-700/60" />
                    </div>
                  ))}
                </div>
              ) : stats?.schedulesByStatus && Object.keys(stats.schedulesByStatus).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.schedulesByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-600 dark:text-gray-300">{status}</span>
                      <Badge variant={status === 'active' ? 'success' : status === 'draft' ? 'warning' : 'default'} className="min-w-12 justify-center tabular-nums">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No schedule status data</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
