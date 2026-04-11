'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { formatTime } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmModal } from '@/components/ui/Modal'
import { schedulesApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { Schedule } from '@/types'

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = { active: 'success', draft: 'warning', inactive: 'default' }

export default function ScheduleViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const fromDepartment = searchParams.get('fromDepartment')
  const backHref = fromDepartment ? `/admin/schedules/department/${fromDepartment}` : '/admin/schedules'

  useEffect(() => {
    schedulesApi.get(Number(id))
      .then(setSchedule)
      .catch(() => setError('Failed to load schedule.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    try { await schedulesApi.delete(Number(id)); router.push(backHref) } catch { setError('Failed to delete.') }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!schedule) return <Alert variant="error">{error || 'Not found.'}</Alert>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" /></Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{schedule.subject.code} – {schedule.section || 'No Section'}</h1>
            <p className="mt-1 text-sm text-gray-500">{schedule.subject.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={`/admin/schedules/${id}/edit${fromDepartment ? `?fromDepartment=${fromDepartment}` : ''}`}><Button size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button></Link>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Schedule Details" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">Academic Year</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.academicYear.year}</dd>
            <dt className="text-gray-500">Semester</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.semester}</dd>
            <dt className="text-gray-500">Day Pattern</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.dayPatternLabel || schedule.dayPattern}</dd>
            <dt className="text-gray-500">Time</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</dd>
            <dt className="text-gray-500">Status</dt><dd><Badge variant={statusVariant[schedule.status] || 'default'}>{schedule.status}</Badge></dd>
            {schedule.isConflicted && <><dt className="text-gray-500">Conflict</dt><dd><Badge variant="danger">Conflicted</Badge></dd></>}
            {schedule.isOverload && <><dt className="text-gray-500">Overload</dt><dd><Badge variant="warning">Overload</Badge></dd></>}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Assignment" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">Subject</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.subject.code} – {schedule.subject.title} ({schedule.subject.units} units)</dd>
            <dt className="text-gray-500">Room</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.room.code}{schedule.room.name ? ` (${schedule.room.name})` : ''}</dd>
            <dt className="text-gray-500">Faculty</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.faculty?.fullName || 'Unassigned'}</dd>
            <dt className="text-gray-500">Section</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.section || '—'}</dd>
            <dt className="text-gray-500">Enrolled</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.enrolledStudents}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Additional Info" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">Notes</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.notes || '—'}</dd>
            <dt className="text-gray-500">Created</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.createdAt ? formatDate(schedule.createdAt) : '—'}</dd>
            <dt className="text-gray-500">Updated</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{schedule.updatedAt ? formatDate(schedule.updatedAt) : '—'}</dd>
          </dl>
        </Card>
      </div>

      <ConfirmModal open={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete} title="Delete Schedule" confirmLabel="Delete" variant="danger" message="Are you sure you want to delete this schedule?" />
    </div>
  )
}
