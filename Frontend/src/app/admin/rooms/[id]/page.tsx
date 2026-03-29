'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, History } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { roomsApi } from '@/lib/admin-api'
import { formatDate, formatTime } from '@/lib/utils'
import type { Room, Schedule } from '@/types'

export default function ViewRoomPage() {
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [history, setHistory] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [r, h] = await Promise.all([roomsApi.get(Number(id)), roomsApi.history(Number(id), { limit: 10 })])
        setRoom(r)
        setHistory(h.data)
      } catch { setError('Failed to load room.') } finally { setLoading(false) }
    }
    load()
  }, [id])

  const historyColumns: Column<Schedule>[] = [
    { key: 'subject', header: 'Subject', render: (s) => `${s.subject.code} - ${s.subject.title}` },
    { key: 'faculty', header: 'Faculty', render: (s) => s.faculty?.fullName || '—' },
    { key: 'dayPattern', header: 'Day', render: (s) => s.dayPatternLabel },
    { key: 'time', header: 'Time', render: (s) => `${formatTime(s.startTime)} - ${formatTime(s.endTime)}` },
    { key: 'status', header: 'Status', render: (s) => <Badge variant={s.status === 'active' ? 'success' : s.status === 'draft' ? 'warning' : 'default'}>{s.status}</Badge> },
  ]

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error) return <Alert variant="error">{error}</Alert>
  if (!room) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/rooms" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{room.code}</h1>
            <p className="mt-1 text-sm text-gray-500">{room.name || 'Room details'}</p>
          </div>
        </div>
        <Link href={`/admin/rooms/${room.id}/edit`}><Button icon={<Pencil className="h-4 w-4" />}>Edit</Button></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Room Information" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="font-medium text-gray-500">Code</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.code}</dd></div>
            <div><dt className="font-medium text-gray-500">Name</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.name || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Type</dt><dd className="mt-1">{room.type ? <Badge variant="info">{room.type}</Badge> : '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Capacity</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.capacity ?? '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Building</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.building || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Floor</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.floor || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Department</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.department?.name || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Status</dt><dd className="mt-1"><Badge variant={room.isActive ? 'success' : 'default'}>{room.isActive ? 'Active' : 'Inactive'}</Badge></dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Metadata" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="font-medium text-gray-500">Created</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.createdAt ? formatDate(room.createdAt) : '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Updated</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.updatedAt ? formatDate(room.updatedAt) : '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Group</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{room.departmentGroup?.name || '—'}</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Schedule History" description="Recent schedules assigned to this room" action={<History className="h-5 w-5 text-gray-400" />} />
        <DataTable columns={historyColumns} data={history} keyExtractor={(s) => s.id} emptyTitle="No schedule history" emptyDescription="This room has not been scheduled yet." />
      </Card>
    </div>
  )
}
