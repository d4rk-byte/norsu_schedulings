'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Pencil, Trash2, ToggleLeft, ToggleRight, GraduationCap, Building2, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { DataTable, type Column, type SortState } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { collegesApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { College, CollegeInput } from '@/types'

export default function CollegesPage() {
  const router = useRouter()
  const list = useCrudList<College>(collegesApi.list)
  const [deleteTarget, setDeleteTarget] = useState<College | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ total: number; active: number; total_departments: number; active_departments: number; active_faculty: number; total_faculty: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<College | null>(null)
  const [form, setForm] = useState<CollegeInput>({ code: '', name: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)

  useEffect(() => { collegesApi.stats().then(setStats).catch(() => {}) }, [])

  function openCreateModal() {
    setFormMode('create')
    setEditTarget(null)
    setForm({ code: '', name: '', dean: '', description: '' })
    setFormErrors({})
    setActionError(null)
    setFormOpen(true)
  }

  function openEditModal(college: College) {
    setFormMode('edit')
    setEditTarget(college)
    setForm({
      code: college.code,
      name: college.name,
      dean: college.dean || '',
      description: college.description || '',
    })
    setFormErrors({})
    setActionError(null)
    setFormOpen(true)
  }

  function closeFormModal() {
    if (formSaving) return
    setFormOpen(false)
  }

  function updateForm(field: keyof CollegeInput, value: string) {
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
      if (formMode === 'create') {
        await collegesApi.create(form)
      } else if (editTarget) {
        await collegesApi.update(editTarget.id, form)
      }

      setFormOpen(false)
      await Promise.all([
        list.refresh(),
        collegesApi.stats().then(setStats).catch(() => {}),
      ])
    } catch {
      setActionError(formMode === 'create' ? 'Failed to create college.' : 'Failed to update college.')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await collegesApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      list.refresh()
    } catch {
      setActionError('Failed to delete college.')
    } finally {
      setDeleting(false)
    }
  }

  async function toggleStatus(college: College) {
    try {
      if (college.isActive) {
        await collegesApi.deactivate(college.id)
      } else {
        await collegesApi.activate(college.id)
      }
      list.refresh()
    } catch {
      setActionError('Failed to update status.')
    }
  }

  const columns: Column<College>[] = [
    { key: 'code', header: 'Code', sortable: true, render: (c) => <span className="font-medium text-gray-900 dark:text-white">{c.code}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (c) => c.name },
    { key: 'dean', header: 'Dean', render: (c) => c.dean || <span className="text-gray-400">—</span> },
    { key: 'departmentCount', header: 'Depts', render: (c) => c.departmentCount ?? 0 },
    {
      key: 'isActive', header: 'Status', sortable: true, render: (c) => (
        <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    { key: 'createdAt', header: 'Created', sortable: true, render: (c) => formatDate(c.createdAt) },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (c) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/colleges/${c.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="View">
            <Eye className="h-4 w-4 text-gray-500" />
          </Link>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(c) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit">
            <Pencil className="h-4 w-4 text-gray-500" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); toggleStatus(c) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title={c.isActive ? 'Deactivate' : 'Activate'}>
            {c.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete">
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Colleges</h1>
          <p className="mt-1 text-sm text-gray-500">Manage colleges in the system.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add College</Button>
      </div>

      {actionError && <Alert variant="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Colleges</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-xs text-green-600 mt-1">{stats.active} active</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><GraduationCap className="h-6 w-6 text-blue-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Departments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_departments}</p>
                <p className="text-xs text-green-600 mt-1">{stats.active_departments} active</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Building2 className="h-6 w-6 text-indigo-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Faculty</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active_faculty}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.total_faculty} total</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><Users className="h-6 w-6 text-green-500" /></div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="mb-4">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search colleges..." className="max-w-sm" />
        </div>

        <DataTable
          columns={columns}
          data={list.data}
          keyExtractor={(c) => c.id}
          loading={list.loading}
          sort={list.sort}
          onSort={list.setSort}
          onRowClick={(c) => router.push(`/admin/colleges/${c.id}`)}
          emptyTitle="No colleges found"
          emptyDescription="Get started by adding a college."
          emptyAction={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add College</Button>}
        />

        <Pagination
          className="mt-4"
          currentPage={list.page}
          totalPages={list.meta.totalPages}
          totalItems={list.meta.total}
          pageSize={list.meta.limit}
          onPageChange={list.setPage}
        />
      </Card>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete College"
        variant="danger"
        confirmLabel="Delete"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
      />

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formMode === 'create' ? 'Add College' : 'Edit College'}
        description={formMode === 'create' ? 'Create a new college record.' : `Update ${editTarget?.name || 'college'} details.`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" type="button" onClick={closeFormModal} disabled={formSaving}>Cancel</Button>
            <Button type="submit" form="college-modal-form" loading={formSaving}>
              {formMode === 'create' ? 'Create College' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        <form id="college-modal-form" onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Code"
              required
              value={form.code || ''}
              onChange={(e) => updateForm('code', e.target.value)}
              error={formErrors.code}
              placeholder="e.g. COE"
            />
            <Input
              label="Name"
              required
              value={form.name || ''}
              onChange={(e) => updateForm('name', e.target.value)}
              error={formErrors.name}
              placeholder="College name"
            />
          </div>

          <Input
            label="Dean"
            value={form.dean || ''}
            onChange={(e) => updateForm('dean', e.target.value)}
            placeholder="Dean name (optional)"
          />

          <Textarea
            label="Description"
            value={form.description || ''}
            onChange={(e) => updateForm('description', e.target.value)}
            placeholder="Description (optional)"
            rows={3}
          />
        </form>
      </Modal>
    </div>
  )
}
