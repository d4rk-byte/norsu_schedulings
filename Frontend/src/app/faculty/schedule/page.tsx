'use client'

import { useEffect, useState } from 'react'
import {
  Clock,
  BookOpen,
  Users,
  MapPin,
  Download,
  CalendarDays,
  FileText,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { SEMESTERS } from '@/lib/constants'
import { facultyApi, type FacultyScheduleResponse, type FacultyWeeklyResponse, type FacultyScheduleItem } from '@/lib/faculty-api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function FacultySchedulePage() {
  const [view, setView] = useState<'list' | 'weekly'>('list')
  const [semester, setSemester] = useState('')
  const [data, setData] = useState<FacultyScheduleResponse | null>(null)
  const [weeklyData, setWeeklyData] = useState<FacultyWeeklyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchData = async (sem?: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await facultyApi.schedule(sem || undefined)
      setData(res)
      if (!sem) setSemester(res.semester)
      if (view === 'weekly') {
        const weekly = await facultyApi.scheduleWeekly(sem || undefined)
        setWeeklyData(weekly)
      }
    } catch {
      setError('Failed to load schedule.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view === 'weekly' && !weeklyData && data) {
      facultyApi.scheduleWeekly(semester || undefined).then(setWeeklyData).catch(() => {})
    }
  }, [view, weeklyData, data, semester])

  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSemester(val)
    setWeeklyData(null)
    fetchData(val)
  }

  const handleExport = async (type: 'schedule' | 'teaching-load') => {
    setExporting(true)
    try {
      if (type === 'schedule') {
        await facultyApi.exportSchedulePdf(semester || undefined)
      } else {
        await facultyApi.exportTeachingLoadPdf(semester || undefined)
      }
    } catch {
      // silent
    } finally {
      setExporting(false)
    }
  }

  const stats = data?.stats

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white/90">Teaching Schedule</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {data?.academic_year ? `${data.academic_year.year}` : ''} {semester ? `— ${semester} Semester` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Select
            value={semester}
            onChange={handleSemesterChange}
            options={SEMESTERS.map(s => ({ value: s, label: `${s} Semester` }))}
            className="w-44 min-w-[11rem]"
          />
          <Button
            type="button"
            variant="outline"
            icon={<Download className="h-4 w-4" />}
            onClick={() => handleExport('schedule')}
            loading={exporting}
            className="whitespace-nowrap flex-shrink-0"
          >
            Schedule PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => handleExport('teaching-load')}
            loading={exporting}
            className="whitespace-nowrap flex-shrink-0"
          >
            Teaching Load PDF
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Hours', value: stats.total_hours, icon: Clock, bg: 'bg-blue-50 dark:bg-blue-500/15', color: 'text-blue-600 dark:text-blue-300' },
            { label: 'Classes', value: stats.total_classes, icon: BookOpen, bg: 'bg-green-50 dark:bg-green-500/15', color: 'text-green-600 dark:text-green-300' },
            { label: 'Students', value: stats.total_students, icon: Users, bg: 'bg-amber-50 dark:bg-amber-500/15', color: 'text-amber-600 dark:text-amber-300' },
            { label: 'Rooms', value: stats.total_rooms, icon: MapPin, bg: 'bg-purple-50 dark:bg-purple-500/15', color: 'text-purple-600 dark:text-purple-300' },
          ].map((s) => (
            <Card key={s.label}>
              <div className="flex items-center gap-3">
                <div className={`${s.bg} p-2.5 rounded-lg`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white/90">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('list')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
          List View
        </button>
        <button
          onClick={() => setView('weekly')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
          Weekly View
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
      ) : view === 'list' ? (
        <ScheduleList schedules={data?.schedules ?? []} />
      ) : (
        <WeeklyView weekly={weeklyData?.weekly ?? {}} />
      )}
    </div>
  )
}

function ScheduleList({ schedules }: { schedules: FacultyScheduleItem[] }) {
  if (schedules.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No schedules found for this semester.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {schedules.map((s) => (
        <Card key={s.id} className="hover:shadow-sm transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-shrink-0 w-20 text-center">
              <p className="text-sm font-bold text-blue-600">{s.start_time_12h}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{s.end_time_12h}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{s.subject.code} — {s.subject.title}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {s.day_pattern_label}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.room.code}{s.room.name ? ` — ${s.room.name}` : ''}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {s.enrolled_students} students</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {s.section && <Badge variant="default">Sec {s.section}</Badge>}
              <Badge variant={s.subject.type === 'laboratory' ? 'warning' : 'primary'}>
                {s.subject.units} units
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function WeeklyView({ weekly }: { weekly: Record<string, FacultyScheduleItem[]> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {DAYS.map((day) => {
        const items = weekly[day] ?? []
        return (
          <Card key={day}>
            <CardHeader title={day} description={`${items.length} class${items.length !== 1 ? 'es' : ''}`} />
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">Free day</p>
            ) : (
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="text-xs font-medium text-blue-600 whitespace-nowrap pt-0.5">
                      {s.start_time_12h}<br />{s.end_time_12h}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">{s.subject.code}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.subject.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Room {s.room.code} &middot; Sec {s.section ?? '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
