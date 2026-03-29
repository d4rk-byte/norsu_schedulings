'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Pencil, Trash2, Filter, DoorOpen, Building, Armchair, Clock, FileDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { roomsApi, collegesApi, departmentsApi, departmentGroupsApi } from '@/lib/admin-api'
import { ROOM_TYPES } from '@/lib/constants'
import type { Room, RoomInput, College, Department, DepartmentGroup } from '@/types'

const FLOOR_OPTIONS = [
  { value: '', label: 'Select floor' },
  { value: '1st', label: '1st Floor' },
  { value: '2nd', label: '2nd Floor' },
  { value: '3rd', label: '3rd Floor' },
  { value: '4th', label: '4th Floor' },
  { value: '5th', label: '5th Floor' },
]

const BUILDING_OPTIONS = [
  { value: '', label: 'Select building' },
  { value: 'CAS', label: 'CAS' },
  { value: 'CIT', label: 'CIT' },
  { value: 'CNPHAS', label: 'CNPHAS' },
]

export default function RoomsPage() {
  const router = useRouter()
  const list = useCrudList<Room>(roomsApi.list)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloadingRoomId, setDownloadingRoomId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ total: number; active: number; recent: number; total_capacity: number; building_counts: Record<string, number> } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Room | null>(null)
  const [form, setForm] = useState<RoomInput>({ code: '', departmentId: 0 })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)

  // Filter state
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [groups, setGroups] = useState<DepartmentGroup[]>([])
  const [filteredDepts, setFilteredDepts] = useState<Department[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')

  useEffect(() => {
    collegesApi.list({ limit: 200 }).then(r => setColleges(r.data)).catch(() => {})
    departmentsApi.list({ limit: 200 }).then(r => setDepartments(r.data)).catch(() => {})
    departmentGroupsApi.list({ limit: 200 }).then(r => setGroups(r.data)).catch(() => {})
    roomsApi.stats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedCollege) {
      setFilteredDepts(departments.filter(d => d.college?.id === Number(selectedCollege)))
    } else {
      setFilteredDepts(departments)
    }
  }, [selectedCollege, departments])

  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (selectedDepartment) params.department_id = selectedDepartment
    list.setExtraParams(params)
  }, [selectedDepartment]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCollegeChange(value: string) {
    setSelectedCollege(value)
    setSelectedDepartment('')
  }

  function clearFilters() {
    setSelectedCollege('')
    setSelectedDepartment('')
  }

  function openCreateModal() {
    setFormMode('create')
    setEditTarget(null)
    setForm({ code: '', name: '', type: '', departmentId: 0, departmentGroupId: undefined, capacity: undefined, building: '', floor: '' })
    setFormErrors({})
    setFormOpen(true)
  }

  function openEditModal(room: Room) {
    setFormMode('edit')
    setEditTarget(room)
    setForm({
      code: room.code,
      name: room.name || '',
      type: room.type || '',
      capacity: room.capacity ?? undefined,
      building: room.building || '',
      floor: room.floor || '',
      departmentId: room.department?.id || 0,
      departmentGroupId: room.departmentGroup?.id,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function closeFormModal() {
    if (formSaving) return
    setFormOpen(false)
  }

  function updateForm(field: keyof RoomInput, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validateForm(): boolean {
    const nextErrors: Record<string, string> = {}
    if (!form.code?.trim()) nextErrors.code = 'Code is required.'
    if (!form.departmentId) nextErrors.departmentId = 'Department is required.'
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    const payload: RoomInput = {
      ...form,
      type: form.type?.trim() ? form.type : undefined,
      building: form.building?.trim() ? form.building : undefined,
      floor: form.floor?.trim() ? form.floor : undefined,
      departmentGroupId: form.departmentGroupId || undefined,
    }

    setFormSaving(true)
    setActionError(null)
    try {
      if (formMode === 'create') {
        await roomsApi.create(payload)
      } else if (editTarget) {
        await roomsApi.update(editTarget.id, payload)
      }

      setFormOpen(false)
      await Promise.all([
        list.refresh(),
        roomsApi.stats().then(setStats).catch(() => {}),
      ])
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setActionError(apiMessage || (formMode === 'create' ? 'Failed to create room.' : 'Failed to update room.'))
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await roomsApi.delete(deleteTarget.id); setDeleteTarget(null); list.refresh() } catch { setActionError('Failed to delete room.') } finally { setDeleting(false) }
  }

  async function previewRoomPdf(room: Room) {
    if (downloadingRoomId === room.id) return

    setDownloadingRoomId(room.id)
    try {
      const blob = await roomsApi.schedulePdf(room.id)
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
    { key: 'code', header: 'Code', sortable: true, render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.code}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => r.name || '—' },
    { key: 'type', header: 'Type', render: (r) => r.type ? <Badge variant="info">{r.type}</Badge> : '—' },
    { key: 'capacity', header: 'Capacity', sortable: true, render: (r) => r.capacity ?? '—' },
    { key: 'building', header: 'Building', sortable: true, render: (r) => r.building || '—' },
    { key: 'department', header: 'Department', render: (r) => r.department?.name || '—' },
    { key: 'isActive', header: 'Status', sortable: true, render: (r) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/rooms/${r.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Eye className="h-4 w-4 text-gray-500" /></Link>
          <button
            onClick={(e) => { e.stopPropagation(); previewRoomPdf(r) }}
            disabled={downloadingRoomId === r.id}
            title="View room PDF"
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="h-4 w-4 text-emerald-600" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(r) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Rooms</h1><p className="mt-1 text-sm text-gray-500">Manage rooms and facilities.</p></div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Room</Button>
      </div>

      {actionError && <Alert variant="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-xs text-green-600 mt-1">{stats.active} active</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><DoorOpen className="h-6 w-6 text-blue-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Capacity</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_capacity}</p>
                <p className="text-xs text-gray-500 mt-1">Across all rooms</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><Armchair className="h-6 w-6 text-green-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Buildings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{Object.keys(stats.building_counts).length}</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Building className="h-6 w-6 text-indigo-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Recently Added</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.recent}</p>
                <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg"><Clock className="h-6 w-6 text-amber-500" /></div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search rooms..." className="max-w-sm" />
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCollege}
                onChange={(e) => handleCollegeChange(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Colleges</option>
                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {(selectedCollege || selectedDepartment) && (
                <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 whitespace-nowrap">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(r) => r.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(r) => router.push(`/admin/rooms/${r.id}`)} emptyTitle="No rooms found" emptyAction={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Room</Button>} />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Room" variant="danger" confirmLabel="Delete" message={`Are you sure you want to delete room "${deleteTarget?.code}"?`} />

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formMode === 'create' ? 'Add Room' : 'Edit Room'}
        description={formMode === 'create' ? 'Create a new room record.' : `Update ${editTarget?.code || 'room'} details.`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" type="button" onClick={closeFormModal} disabled={formSaving}>Cancel</Button>
            <Button type="submit" form="room-modal-form" loading={formSaving}>
              {formMode === 'create' ? 'Create Room' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        <form id="room-modal-form" onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Code"
              required
              value={form.code || ''}
              onChange={(e) => updateForm('code', e.target.value)}
              error={formErrors.code}
              placeholder="e.g. RM101"
            />
            <Input
              label="Name"
              value={form.name || ''}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Room name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Type"
              value={form.type || ''}
              onChange={(e) => updateForm('type', e.target.value || undefined)}
              options={[{ value: '', label: 'Select type' }, ...ROOM_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))]}
            />
            <Input
              label="Capacity"
              type="number"
              min={1}
              value={form.capacity ?? ''}
              onChange={(e) => updateForm('capacity', e.target.value ? Number(e.target.value) : undefined)}
            />
            <Select
              label="Floor"
              value={form.floor || ''}
              onChange={(e) => updateForm('floor', e.target.value || undefined)}
              options={FLOOR_OPTIONS}
            />
          </div>

          <Select
            label="Building"
            value={form.building || ''}
            onChange={(e) => updateForm('building', e.target.value || undefined)}
            options={BUILDING_OPTIONS}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Department"
              value={form.departmentId ? String(form.departmentId) : ''}
              onChange={(e) => updateForm('departmentId', e.target.value ? Number(e.target.value) : 0)}
              options={[{ value: '', label: 'Select department' }, ...departments.map((d) => ({ value: String(d.id), label: d.name }))]}
              error={formErrors.departmentId}
            />
            <Select
              label="Department Group"
              value={form.departmentGroupId ? String(form.departmentGroupId) : ''}
              onChange={(e) => updateForm('departmentGroupId', e.target.value ? Number(e.target.value) : undefined)}
              options={[{ value: '', label: 'Select group (optional)' }, ...groups.map((g) => ({ value: String(g.id), label: g.name }))]}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
