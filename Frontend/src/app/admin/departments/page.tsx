'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Pencil, Trash2, ToggleLeft, ToggleRight, Filter, Building2, Users, UserCheck, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { departmentsApi, collegesApi, departmentGroupsApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { Department, DepartmentInput, College, DepartmentGroup } from '@/types'

export default function DepartmentsPage() {
  const router = useRouter()
  const list = useCrudList<Department>(departmentsApi.list)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Filter state
  const [colleges, setColleges] = useState<College[]>([])
  const [groups, setGroups] = useState<DepartmentGroup[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('')
  const [stats, setStats] = useState<{ total: number; active: number; recent: number; with_head: number; without_head: number; total_faculty: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [form, setForm] = useState<DepartmentInput>({ code: '', name: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      collegesApi.list({ limit: 200 }),
      departmentGroupsApi.list({ limit: 200 }),
    ]).then(([c, g]) => {
      setColleges(c.data)
      setGroups(g.data)
    }).catch(() => {})
    departmentsApi.stats().then(setStats).catch(() => {})
  }, [])

  function openCreateModal() {
    setFormMode('create')
    setEditTarget(null)
    setForm({
      code: '',
      name: '',
      description: '',
      contactEmail: '',
      collegeId: undefined,
      departmentGroupId: undefined,
    })
    setFormErrors({})
    setActionError(null)
    setFormOpen(true)
  }

  function openEditModal(dept: Department) {
    setFormMode('edit')
    setEditTarget(dept)
    setForm({
      code: dept.code,
      name: dept.name,
      description: dept.description || '',
      contactEmail: dept.contactEmail || '',
      collegeId: dept.college?.id,
      departmentGroupId: dept.departmentGroup?.id,
    })
    setFormErrors({})
    setActionError(null)
    setFormOpen(true)
  }

  function closeFormModal() {
    if (formSaving) return
    setFormOpen(false)
  }

  function updateForm(field: keyof DepartmentInput, value: string | number | undefined) {
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
    if (!form.name?.trim()) nextErrors.name = 'Name is required.'
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    setFormSaving(true)
    setActionError(null)
    try {
      const payload: DepartmentInput = {
        ...form,
        collegeId: form.collegeId || undefined,
        departmentGroupId: form.departmentGroupId || undefined,
      }

      if (formMode === 'create') {
        await departmentsApi.create(payload)
      } else if (editTarget) {
        await departmentsApi.update(editTarget.id, payload)
      }

      setFormOpen(false)
      await Promise.all([
        list.refresh(),
        departmentsApi.stats().then(setStats).catch(() => {}),
      ])
    } catch {
      setActionError(formMode === 'create' ? 'Failed to create department.' : 'Failed to update department.')
    } finally {
      setFormSaving(false)
    }
  }

  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (selectedCollege) params.college_id = selectedCollege
    list.setExtraParams(params)
  }, [selectedCollege]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await departmentsApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      list.refresh()
    } catch {
      setActionError('Failed to delete department.')
    } finally {
      setDeleting(false)
    }
  }

  async function toggleStatus(dept: Department) {
    try {
      await departmentsApi.toggleStatus(dept.id)
      list.refresh()
    } catch {
      setActionError('Failed to update status.')
    }
  }

  const columns: Column<Department>[] = [
    { key: 'code', header: 'Code', sortable: true, render: (d) => <span className="font-medium text-gray-900 dark:text-white">{d.code}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (d) => d.name },
    { key: 'college', header: 'College', render: (d) => d.college?.name || <span className="text-gray-400">—</span> },
    { key: 'head', header: 'Head', render: (d) => d.head?.fullName || <span className="text-gray-400">—</span> },
    { key: 'isActive', header: 'Status', sortable: true, render: (d) => <Badge variant={d.isActive ? 'success' : 'default'}>{d.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'createdAt', header: 'Created', sortable: true, render: (d) => formatDate(d.createdAt) },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (d) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/departments/${d.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Eye className="h-4 w-4 text-gray-500" /></Link>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(d) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit">
            <Pencil className="h-4 w-4 text-gray-500" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); toggleStatus(d) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            {d.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(d) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Departments</h1>
          <p className="mt-1 text-sm text-gray-500">Manage departments across all colleges.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Department</Button>
      </div>

      {actionError && <Alert variant="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Departments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-xs text-green-600 mt-1">{stats.active} active</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Building2 className="h-6 w-6 text-blue-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Faculty</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_faculty}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><Users className="h-6 w-6 text-green-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">With Dept Head</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.with_head}</p>
                <p className="text-xs text-amber-600 mt-1">{stats.without_head} without</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg"><UserCheck className="h-6 w-6 text-purple-500" /></div>
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
            <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search departments..." className="max-w-sm" />
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Colleges</option>
                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCollege && (
                <button onClick={() => setSelectedCollege('')} className="text-sm text-primary-600 hover:text-primary-800 whitespace-nowrap">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(d) => d.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(d) => router.push(`/admin/departments/${d.id}`)} emptyTitle="No departments found" emptyDescription="Get started by adding a department." emptyAction={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Department</Button>} />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Department" variant="danger" confirmLabel="Delete" message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`} />

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formMode === 'create' ? 'Add Department' : 'Edit Department'}
        description={formMode === 'create' ? 'Create a new department record.' : `Update ${editTarget?.name || 'department'} details.`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" type="button" onClick={closeFormModal} disabled={formSaving}>Cancel</Button>
            <Button type="submit" form="department-modal-form" loading={formSaving}>
              {formMode === 'create' ? 'Create Department' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        <form id="department-modal-form" onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Code"
              required
              value={form.code || ''}
              onChange={(e) => updateForm('code', e.target.value)}
              error={formErrors.code}
              placeholder="e.g. CS"
            />
            <Input
              label="Name"
              required
              value={form.name || ''}
              onChange={(e) => updateForm('name', e.target.value)}
              error={formErrors.name}
              placeholder="Department name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="College"
              value={form.collegeId ? String(form.collegeId) : ''}
              onChange={(e) => updateForm('collegeId', e.target.value ? Number(e.target.value) : undefined)}
              options={[
                { value: '', label: 'Select college' },
                ...colleges.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
            <Select
              label="Department Group"
              value={form.departmentGroupId ? String(form.departmentGroupId) : ''}
              onChange={(e) => updateForm('departmentGroupId', e.target.value ? Number(e.target.value) : undefined)}
              options={[
                { value: '', label: 'Select group (optional)' },
                ...groups.map((g) => ({ value: String(g.id), label: g.name })),
              ]}
            />
          </div>

          <Input
            label="Contact Email"
            type="email"
            value={form.contactEmail || ''}
            onChange={(e) => updateForm('contactEmail', e.target.value)}
            placeholder="dept@example.edu"
          />

          <Textarea
            label="Description"
            value={form.description || ''}
            onChange={(e) => updateForm('description', e.target.value)}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  )
}
