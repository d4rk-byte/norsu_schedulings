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
        const activeSemester = typeof settings.activeSemester === 'string' ? settings.activeSemester : ''

        ayFilter.setSelectedAyId(currentAy?.id ? String(currentAy.id) : '')
        ayFilter.setSelectedSemester(activeSemester)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setLoading(true)
    dhDashboard.stats({
      academic_year_id: ayFilter.selectedAyId || undefined,
      semester: ayFilter.selectedSemester || undefined,
    })
      .then(setStats)
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false))
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
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 rounded-full text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
          {currentFilterLabel}
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
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-300 dark:text-gray-500" /> : s.value}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Conflicts alert */}
      {stats && stats.conflicts > 0 && (
        <Alert variant="warning" title={`${stats.conflicts} Schedule Conflict${stats.conflicts > 1 ? 's' : ''} Detected`}>
          <Link href="/department-head/schedules" className="underline font-medium">View schedules</Link> to resolve conflicts.
        </Alert>
      )}

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Faculty Workloads */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Faculty Workloads" description="Top faculty by teaching load" action={<Link href="/department-head/reports/faculty-workload" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">View All</Link>} />
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300 dark:text-gray-500" /></div>
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
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader
              title="Recent Activity"
              description="Latest changes in your department"
              action={<Link href="/department-head/activity-logs" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">View All</Link>}
            />
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300 dark:text-gray-500" /></div>
            ) : stats?.recentActivities && stats.recentActivities.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {stats.recentActivities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
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
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><UserCheck className="h-4 w-4" /> Active Faculty</span>
                <Badge variant="success">{loading ? '—' : stats?.activeFaculty ?? 0}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><AlertTriangle className="h-4 w-4" /> Inactive Faculty</span>
                <Badge variant={stats?.inactiveFaculty ? 'warning' : 'default'}>{loading ? '—' : stats?.inactiveFaculty ?? 0}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><AlertCircle className="h-4 w-4" /> Conflicts</span>
                <Badge variant={stats?.conflicts ? 'danger' : 'success'}>{loading ? '—' : stats?.conflicts ?? 0}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><DoorOpen className="h-4 w-4" /> Room Utilization</span>
                <Badge variant="primary">{loading ? '—' : `${stats?.roomUtilization ?? 0}%`}</Badge>
              </li>
            </ul>
          </Card>

          {stats?.schedulesByStatus && (
            <Card>
              <CardHeader title="Schedule Status" />
              <div className="space-y-2">
                {Object.entries(stats.schedulesByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-600 dark:text-gray-300">{status}</span>
                    <Badge variant={status === 'active' ? 'success' : status === 'draft' ? 'warning' : 'default'}>{count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
