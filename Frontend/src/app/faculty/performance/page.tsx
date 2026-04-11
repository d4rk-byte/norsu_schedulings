'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  Award,
  BarChart3,
  Users,
  Star,
  BookOpen,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { facultyApi, type FacultyScheduleResponse } from '@/lib/faculty-api'

export default function FacultyPerformancePage() {
  const { user } = useAuth()
  const [scheduleData, setScheduleData] = useState<FacultyScheduleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    facultyApi.schedule()
      .then(setScheduleData)
      .catch(() => setError('Failed to load performance data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
  if (error) return <Alert variant="error">{error}</Alert>

  const stats = scheduleData?.stats
  const schedules = scheduleData?.schedules ?? []

  // Derive per-class breakdown
  const classBreakdown = schedules.map((s) => ({
    code: s.subject.code,
    title: s.subject.title,
    students: s.enrolled_students,
    section: s.section,
    type: s.subject.type,
  }))

  const totalUnits = schedules.reduce((sum, s) => sum + (s.subject.units ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Performance Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Teaching performance summary for {user?.firstName ?? 'Faculty'} &mdash; {scheduleData?.academic_year?.year ?? ''}, {scheduleData?.semester ?? ''} Semester
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Teaching Hours', value: stats?.total_hours ?? 0, icon: TrendingUp, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Total Classes', value: stats?.total_classes ?? 0, icon: BookOpen, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Total Students', value: stats?.total_students ?? 0, icon: Users, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Total Units', value: totalUnits, icon: Award, bg: 'bg-purple-50', color: 'text-purple-600' },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <div className={`${s.bg} p-2.5 rounded-lg`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class breakdown */}
        <Card>
          <CardHeader title="Class Breakdown" description="Your assigned classes this semester" />
          {classBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No classes this semester.</p>
          ) : (
            <div className="space-y-3">
              {classBreakdown.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="shrink-0 h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.code}</p>
                    <p className="text-xs text-gray-500 truncate">{c.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{c.students} students</p>
                    <p className="text-xs text-gray-400">Sec {c.section ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Teaching Load Summary */}
        <Card>
          <CardHeader title="Teaching Load Summary" description="Workload distribution" />
          <div className="space-y-4">
            {/* Hours bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Weekly Hours</span>
                <span className="text-sm font-semibold text-gray-900">{stats?.total_hours ?? 0}h</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min((stats?.total_hours ?? 0) / 30 * 100, 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-400">Based on 30h max capacity</p>
            </div>

            {/* Classes bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Classes</span>
                <span className="text-sm font-semibold text-gray-900">{stats?.total_classes ?? 0}</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min((stats?.total_classes ?? 0) / 10 * 100, 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-400">Based on 10 max classes</p>
            </div>

            {/* Units bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Total Units</span>
                <span className="text-sm font-semibold text-gray-900">{totalUnits}</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(totalUnits / 24 * 100, 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-400">Based on 24 max units</p>
            </div>

            {/* Subject type distribution */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Subject Types</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  schedules.reduce<Record<string, number>>((acc, s) => {
                    const type = s.subject.type ?? 'lecture'
                    acc[type] = (acc[type] || 0) + 1
                    return acc
                  }, {})
                ).map(([type, count]) => (
                  <Badge key={type} variant={type === 'laboratory' ? 'warning' : type === 'lecture-lab' ? 'info' : 'primary'}>
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Info banner */}
      <Alert variant="info">
        Performance metrics such as student ratings, pass rates, and attendance tracking will be available in a future update.
      </Alert>
    </div>
  )
}
