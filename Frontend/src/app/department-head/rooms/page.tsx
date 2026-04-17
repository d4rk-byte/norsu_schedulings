'use client'

import { useRouter } from 'next/navigation'
import { Plus, Eye, Edit, FileDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { dhRoomsApi } from '@/lib/department-head-api'
import { ROOM_TYPES } from '@/lib/constants'
import { useState } from 'react'
import type { Room } from '@/types'

interface FormState {
  code: string
  name: string
  building: string
  floor: string
  type: string
  capacity: number | ''
}

export default function DHRoomsListPage() {
  const router = useRouter()
  const list = useCrudList<Room>((p) => dhRoomsApi.list(p))
  const [toggleRoom, setToggleRoom] = useState<Room | null>(null)
  const [toggling, setToggling] = useState(false)
  const [downloadingRoomId, setDownloadingRoomId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [form, setForm] = useState<FormState>({ code: '', name: '', building: '', floor: '', type: 'lecture', capacity: '' })
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editTarget, setEditTarget] = useState<Room | null>(null)
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [editForm, setEditForm] = useState<FormState>({ code: '', name: '', building: '', floor: '', type: 'lecture', capacity: '' })

  const roomTypeOptions = ROOM_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

  function resetCreateForm() {
    setForm({ code: '', name: '', building: '', floor: '', type: 'lecture', capacity: '' })
    setFormErrors({})
    setCreateError('')
  }

  function openCreateModal() {
    resetCreateForm()
    setCreateOpen(true)
  }

  function openEditModal(room: Room) {
    setEditTarget(room)
    setEditForm({
      code: room.code || '',
      name: room.name || '',
      building: room.building || '',
      floor: room.floor != null ? String(room.floor) : '',
      type: room.type || 'lecture',
      capacity: room.capacity ?? '',
    })
    setEditFormErrors({})
    setEditError('')
    setEditOpen(true)
  }

  function closeCreateModal() {
    if (createSaving) return
    setCreateOpen(false)
  }

  function closeEditModal() {
    if (editSaving) return
    setEditOpen(false)
    setEditTarget(null)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function setEditField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
    setEditFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validateCreateForm() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {}
    if (!form.code.trim()) nextErrors.code = 'Required'
    if (!form.name.trim()) nextErrors.name = 'Required'

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validateEditForm() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {}
    if (!editForm.code.trim()) nextErrors.code = 'Required'
    if (!editForm.name.trim()) nextErrors.name = 'Required'

    setEditFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!validateCreateForm()) return

    setCreateSaving(true)
    setCreateError('')
    try {
      await dhRoomsApi.create({
        code: form.code.trim(),
        name: form.name.trim(),
        building: form.building.trim() || undefined,
        floor: form.floor.trim() || undefined,
        type: form.type,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      })
      setCreateOpen(false)
      list.refresh()
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to create room.')
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleEditRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget || !validateEditForm()) return

    setEditSaving(true)
    setEditError('')
    try {
      await dhRoomsApi.update(editTarget.id, {
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        building: editForm.building.trim() || undefined,
        floor: editForm.floor.trim() || undefined,
        type: editForm.type,
        capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
      })
      setEditOpen(false)
      setEditTarget(null)
      list.refresh()
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to update room.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleToggle() {
    if (!toggleRoom) return
    setToggling(true)
    try {
      const fn = toggleRoom.isActive ? dhRoomsApi.deactivate : dhRoomsApi.activate
      await fn(toggleRoom.id)
      list.refresh()
    } catch {}
    setToggling(false)
    setToggleRoom(null)
  }

  async function previewRoomPdf(room: Room) {
    if (downloadingRoomId === room.id) return

    setDownloadingRoomId(room.id)
    setActionError(null)
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
      setDownloadingRoomId(null)
    }
  }

  const columns: Column<Room>[] = [
    { key: 'code', header: 'Code', sortable: true, render: (r) => <span className="font-medium text-gray-900">{r.code}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => r.name },
    { key: 'building', header: 'Building', render: (r) => r.building || '—' },
    { key: 'floor', header: 'Floor', render: (r) => r.floor ?? '—' },
    { key: 'type', header: 'Type', render: (r) => <Badge variant="default">{r.type}</Badge> },
    { key: 'capacity', header: 'Capacity', render: (r) => r.capacity ?? '—' },
    { key: 'isActive', header: 'Status', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); setToggleRoom(r) }}>
        <Badge variant={r.isActive ? 'success' : 'danger'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
      </button>
    )},
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); router.push(`/department-head/rooms/${r.id}`) }} className="p-1.5 rounded hover:bg-gray-100"><Eye className="h-4 w-4 text-gray-500" /></button>
        <button
          onClick={(e) => { e.stopPropagation(); previewRoomPdf(r) }}
          disabled={downloadingRoomId === r.id}
          title="View room PDF"
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileDown className="h-4 w-4 text-emerald-600" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); openEditModal(r) }} className="p-1.5 rounded hover:bg-gray-100"><Edit className="h-4 w-4 text-gray-500" /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Rooms</h1>
          <p className="mt-1 text-sm text-gray-500">Manage rooms assigned to your department</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Room</Button>
      </div>

      {list.error && <Alert variant="error">{list.error}</Alert>}
      {actionError && <Alert variant="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search rooms..." className="max-w-sm mb-4" />
        <DataTable columns={columns} data={list.data} keyExtractor={(r) => r.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(r) => router.push(`/department-head/rooms/${r.id}`)} emptyTitle="No rooms found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal open={!!toggleRoom} onClose={() => setToggleRoom(null)} onConfirm={handleToggle} loading={toggling} title={toggleRoom?.isActive ? 'Deactivate Room' : 'Activate Room'} message={`Are you sure you want to ${toggleRoom?.isActive ? 'deactivate' : 'activate'} room "${toggleRoom?.code}"?`} variant={toggleRoom?.isActive ? 'danger' : 'primary'} confirmLabel={toggleRoom?.isActive ? 'Deactivate' : 'Activate'} />

      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title="Add Room"
        description="Register a new room for your department."
        size="lg"
      >
        {createError && <Alert variant="error">{createError}</Alert>}

        <form onSubmit={handleCreateRoom} className="space-y-4 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Room Code" required value={form.code} onChange={(e) => setField('code', e.target.value)} error={formErrors.code} placeholder="e.g. R-201" />
            <Input label="Room Name" required value={form.name} onChange={(e) => setField('name', e.target.value)} error={formErrors.name} placeholder="e.g. Lecture Room 201" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Building" value={form.building} onChange={(e) => setField('building', e.target.value)} placeholder="e.g. Main Building" />
            <Input label="Floor" value={form.floor} onChange={(e) => setField('floor', e.target.value)} placeholder="e.g. 2nd" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Room Type" value={form.type} onChange={(e) => setField('type', e.target.value)} options={roomTypeOptions} />
            <Input
              label="Capacity"
              type="number"
              value={form.capacity !== '' ? String(form.capacity) : ''}
              onChange={(e) => setField('capacity', e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 40"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeCreateModal} disabled={createSaving}>Cancel</Button>
            <Button type="submit" loading={createSaving}>Create Room</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={closeEditModal}
        title="Edit Room"
        description={editTarget ? `Update details for room ${editTarget.code}.` : 'Update room details.'}
        size="lg"
      >
        {editError && <Alert variant="error">{editError}</Alert>}

        <form onSubmit={handleEditRoom} className="space-y-4 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Room Code" required value={editForm.code} onChange={(e) => setEditField('code', e.target.value)} error={editFormErrors.code} placeholder="e.g. R-201" />
            <Input label="Room Name" required value={editForm.name} onChange={(e) => setEditField('name', e.target.value)} error={editFormErrors.name} placeholder="e.g. Lecture Room 201" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Building" value={editForm.building} onChange={(e) => setEditField('building', e.target.value)} placeholder="e.g. Main Building" />
            <Input label="Floor" value={editForm.floor} onChange={(e) => setEditField('floor', e.target.value)} placeholder="e.g. 2nd" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Room Type" value={editForm.type} onChange={(e) => setEditField('type', e.target.value)} options={roomTypeOptions} />
            <Input
              label="Capacity"
              type="number"
              value={editForm.capacity !== '' ? String(editForm.capacity) : ''}
              onChange={(e) => setEditField('capacity', e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 40"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeEditModal} disabled={editSaving}>Cancel</Button>
            <Button type="submit" loading={editSaving}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
