'use client'

import { Plus, Pencil, Trash2, Layers, Building2, CircleDashed, Save } from 'lucide-react'
import { useState, useEffect, FormEvent, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import MultiSelect from '@/components/form/MultiSelect'
import { useCrudList } from '@/hooks/useCrudList'
import { departmentGroupsApi, departmentsApi } from '@/lib/admin-api'
import type { Department, DepartmentGroup, DepartmentGroupInput } from '@/types'

type ModalMode = 'create' | 'edit' | null

const initialFormState: DepartmentGroupInput = {
  name: '',
  description: '',
  color: '#3b82f6',
  departmentIds: [],
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export default function DepartmentGroupsPage() {
  const list = useCrudList<DepartmentGroup>((p) => departmentGroupsApi.list(p))
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [stats, setStats] = useState<{ total_groups: number; grouped_departments: number; ungrouped_departments: number } | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)

  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<DepartmentGroupInput>(initialFormState)
  const [initialDeptIds, setInitialDeptIds] = useState<string[]>([])

  const loadStats = async () => {
    try {
      const nextStats = await departmentGroupsApi.stats()
      setStats(nextStats)
    } catch {
      // keep silent to avoid disrupting list usage
    }
  }

  useEffect(() => {
    void loadStats()
  }, [])

  useEffect(() => {
    departmentsApi.list({ limit: 200 })
      .then((response) => setDepartments(response.data))
      .catch(() => {
        setModalError('Failed to load departments list.')
      })
      .finally(() => setLoadingDepartments(false))
  }, [])

  const isModalOpen = modalMode !== null

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: String(d.id), text: d.name, selected: false })),
    [departments],
  )

  const resetModalState = () => {
    setModalMode(null)
    setEditingGroupId(null)
    setModalLoading(false)
    setModalSaving(false)
    setModalError('')
    setFormErrors({})
    setForm(initialFormState)
    setInitialDeptIds([])
  }

  const openCreateModal = () => {
    setModalMode('create')
    setEditingGroupId(null)
    setModalError('')
    setFormErrors({})
    setForm(initialFormState)
    setInitialDeptIds([])
  }

  const openEditModal = async (group: DepartmentGroup) => {
    setModalMode('edit')
    setEditingGroupId(group.id)
    setModalLoading(true)
    setModalError('')
    setFormErrors({})

    try {
      const groupDetails = await departmentGroupsApi.get(group.id)
      const groupDeptIds = (groupDetails.departments || []).map((department) => department.id)

      setInitialDeptIds(groupDeptIds.map(String))
      setForm({
        name: groupDetails.name,
        description: groupDetails.description || '',
        color: groupDetails.color || '#3b82f6',
        departmentIds: groupDeptIds,
      })
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, 'Failed to load group details.'))
    } finally {
      setModalLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!form.name?.trim()) {
      nextErrors.name = 'Name is required.'
    }

    setFormErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  async function handleModalSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validateForm()) return

    if (modalMode === 'edit' && !editingGroupId) {
      setModalError('Missing group identifier for update.')
      return
    }

    setModalSaving(true)
    setModalError('')

    try {
      if (modalMode === 'create') {
        await departmentGroupsApi.create(form)
      } else {
        await departmentGroupsApi.update(editingGroupId as number, form)
      }

      await Promise.all([list.refresh(), loadStats()])
      resetModalState()
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, modalMode === 'create' ? 'Failed to create group.' : 'Failed to update group.'))
    } finally {
      setModalSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await departmentGroupsApi.delete(deleteId)
      await Promise.all([list.refresh(), loadStats()])
    } catch {
      // keep silent to avoid disrupting main table interactions
    }
    setDeleteId(null)
  }

  const columns: Column<DepartmentGroup>[] = [
    {
      key: 'name', header: 'Group Name', sortable: true,
      render: (g) => (
        <div className="flex items-center gap-2">
          {g.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />}
          <span className="font-medium text-gray-900 dark:text-white">{g.name}</span>
        </div>
      ),
    },
    { key: 'description', header: 'Description', render: (g) => g.description || '—' },
    { key: 'departments', header: 'Departments', render: (g) => <Badge variant="primary">{g.departments?.length || 0}</Badge> },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (g) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void openEditModal(g)
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="h-4 w-4 text-gray-500" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(g.id) }} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Department Groups</h1><p className="mt-1 text-sm text-gray-500">Organize departments into groups.</p></div>
        <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" />Add Group</Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Groups</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_groups}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Layers className="h-6 w-6 text-blue-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Grouped Departments</p>
                <p className="text-2xl font-bold text-green-600">{stats.grouped_departments}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><Building2 className="h-6 w-6 text-green-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ungrouped</p>
                <p className="text-2xl font-bold text-amber-600">{stats.ungrouped_departments}</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg"><CircleDashed className="h-6 w-6 text-amber-500" /></div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="mb-4"><SearchBar value={list.search} onChange={list.setSearch} placeholder="Search groups..." className="max-w-sm" /></div>
        <DataTable columns={columns} data={list.data} keyExtractor={(g) => g.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(g) => { void openEditModal(g) }} emptyTitle="No groups found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <Modal
        open={isModalOpen}
        onClose={resetModalState}
        size="lg"
        title={modalMode === 'create' ? 'Add Department Group' : 'Edit Department Group'}
        description={modalMode === 'create' ? 'Create a new group for organizing departments.' : 'Update group details and assigned departments.'}
      >
        {modalError && <Alert variant="error">{modalError}</Alert>}

        {modalLoading || loadingDepartments ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <form onSubmit={handleModalSubmit} className="space-y-4">
            <Input
              label="Group Name"
              required
              value={form.name || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              error={formErrors.name}
            />

            <Input
              label="Color"
              type="color"
              value={form.color || '#3b82f6'}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            />

            <Textarea
              label="Description"
              rows={3}
              value={form.description || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />

            <MultiSelect
              key={`${modalMode}-${editingGroupId ?? 'new'}-${initialDeptIds.join(',')}`}
              label="Departments"
              options={departmentOptions}
              defaultSelected={initialDeptIds}
              onChange={(selected) => setForm((prev) => ({ ...prev, departmentIds: selected.map(Number) }))}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={resetModalState} disabled={modalSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={modalSaving}>
                <Save className="h-4 w-4 mr-2" />
                {modalSaving ? 'Saving...' : modalMode === 'create' ? 'Create Group' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Group" confirmLabel="Delete" variant="danger" message="Are you sure you want to delete this department group?" />
    </div>
  )
}
