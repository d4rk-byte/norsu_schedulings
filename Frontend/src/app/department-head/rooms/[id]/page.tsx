'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, FileDown, Loader2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ConfirmModal } from '@/components/ui/Modal'
import { dhRoomsApi } from '@/lib/department-head-api'
import type { Room } from '@/types'

export default function DHRoomViewPage() {
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showToggle, setShowToggle] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    dhRoomsApi.get(Number(id))
      .then(setRoom)
      .catch(() => setError('Failed to load room'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleToggle() {
    if (!room) return
    setToggling(true)
    try {
      const fn = room.isActive ? dhRoomsApi.deactivate : dhRoomsApi.activate
      await fn(room.id)
      setRoom(prev => prev ? { ...prev, isActive: !prev.isActive } : prev)
    } catch {}
    setToggling(false)
    setShowToggle(false)
  }

  async function handleDownloadPdf() {
    if (!room || downloadingPdf) return

    setDownloadingPdf(true)
    setActionError('')
    try {
      const blob = await dhRoomsApi.schedulePdf(room.id)
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000)
    } catch {
      setActionError('Could not open room PDF preview. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  if (error || !room) return <Alert variant="error">{error || 'Room not found'}</Alert>

  return (
    <div className="space-y-6">
      {actionError && <Alert variant="error" onDismiss={() => setActionError('')}>{actionError}</Alert>}

      <div className="flex items-center gap-4">
        <Link href="/department-head/rooms" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{room.code} – {room.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Room Details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" icon={<FileDown className="h-4 w-4" />} onClick={handleDownloadPdf} loading={downloadingPdf}>
            Download PDF
          </Button>
          <Button variant={room.isActive ? 'danger' : 'secondary'} onClick={() => setShowToggle(true)}>
            {room.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Link href={`/department-head/rooms/${room.id}/edit`}>
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />}>Edit</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Room Information" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-gray-500">Code</dt><dd className="mt-1 font-medium text-gray-900">{room.code}</dd></div>
              <div><dt className="text-gray-500">Name</dt><dd className="mt-1 font-medium text-gray-900">{room.name}</dd></div>
              <div><dt className="text-gray-500">Building</dt><dd className="mt-1 font-medium text-gray-900">{room.building || '—'}</dd></div>
              <div><dt className="text-gray-500">Floor</dt><dd className="mt-1 font-medium text-gray-900">{room.floor ?? '—'}</dd></div>
              <div><dt className="text-gray-500">Type</dt><dd className="mt-1 font-medium text-gray-900">{room.type}</dd></div>
              <div><dt className="text-gray-500">Capacity</dt><dd className="mt-1 font-medium text-gray-900">{room.capacity ?? '—'}</dd></div>
              {(room as any).equipment && <div className="sm:col-span-2"><dt className="text-gray-500">Equipment</dt><dd className="mt-1 font-medium text-gray-900">{(room as any).equipment}</dd></div>}
            </dl>
          </Card>
        </div>
        <Card>
          <CardHeader title="Status" />
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Active</span>
              <Badge variant={room.isActive ? 'success' : 'danger'}>{room.isActive ? 'Yes' : 'No'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Created</span>
              <span className="font-medium">{room.createdAt ? new Date(room.createdAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmModal open={showToggle} onClose={() => setShowToggle(false)} onConfirm={handleToggle} loading={toggling} title={room.isActive ? 'Deactivate Room' : 'Activate Room'} message={`Are you sure you want to ${room.isActive ? 'deactivate' : 'activate'} this room?`} variant={room.isActive ? 'danger' : 'primary'} confirmLabel={room.isActive ? 'Deactivate' : 'Activate'} />
    </div>
  )
}
