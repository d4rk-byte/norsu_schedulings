'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { dhSchedulesApi } from '@/lib/department-head-api'
import { formatDate, formatTime } from '@/lib/utils'
import type { Schedule } from '@/types'

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  draft: 'warning',
  inactive: 'default',
}

export default function DHScheduleViewPage() {
  const { id } = useParams<{ id: string }>()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    dhSchedulesApi
      .get(Number(id))
      .then(setSchedule)
      .catch(() => setError('Failed to load schedule.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error || !schedule) return <Alert variant="error">{error || 'Schedule not found.'}</Alert>

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/department-head/schedules" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{schedule.subject.code} – {schedule.section || 'No Section'}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{schedule.subject.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/department-head/schedules/${id}/edit`}>
            <Button size="sm" icon={<Pencil className="h-4 w-4" />}>Edit</Button>
          </Link>
        </div>
      </div>

      {schedule.isConflicted && (
        <Alert variant="error" title="Schedule Conflict">
          This schedule has a detected conflict. Please review and resolve.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Schedule Details" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">Academic Year</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.academicYear.year}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Semester</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.semester}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Day Pattern</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.dayPatternLabel || schedule.dayPattern || '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Time</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Status</dt><dd><Badge variant={statusVariant[schedule.status] || 'default'}>{schedule.status}</Badge></dd>
            {schedule.isConflicted && <><dt className="text-gray-500 dark:text-gray-400">Conflict</dt><dd><Badge variant="danger">Conflicted</Badge></dd></>}
            {schedule.isOverload && <><dt className="text-gray-500 dark:text-gray-400">Overload</dt><dd><Badge variant="warning">Overload</Badge></dd></>}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Assignment" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">Subject</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.subject.code} – {schedule.subject.title} ({schedule.subject.units} units)</dd>
            <dt className="text-gray-500 dark:text-gray-400">Room</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.room.code}{schedule.room.name ? ` (${schedule.room.name})` : ''}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Faculty</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.faculty?.fullName || 'Unassigned'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Section</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.section || '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Enrolled</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.enrolledStudents ?? '—'}</dd>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Additional Info" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">Notes</dt><dd className="font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{schedule.notes || '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Created</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.createdAt ? formatDate(schedule.createdAt) : '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Updated</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.updatedAt ? formatDate(schedule.updatedAt) : '—'}</dd>
          </dl>
        </Card>
      </div>
    </div>
  )
}
