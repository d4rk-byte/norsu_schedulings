'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Pencil, Trash2, Filter } from 'lucide-react'
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
import { subjectsApi, collegesApi, departmentsApi } from '@/lib/admin-api'
import { SEMESTERS, SUBJECT_TYPES } from '@/lib/constants'
import type { Subject, SubjectInput, College, Department } from '@/types'

export default function SubjectsPage() {
  const router = useRouter()
  const list = useCrudList<Subject>(subjectsApi.list)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Subject | null>(null)
  const [form, setForm] = useState<SubjectInput>({ code: '', title: '', units: 3, departmentId: 0 })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)

  // Filter state
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [filteredDepts, setFilteredDepts] = useState<Department[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedSemester, setSelectedSemester] = useState<string>('')
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('')

  useEffect(() => {
    collegesApi.list({ limit: 200 }).then(r => setColleges(r.data)).catch(() => {})
    departmentsApi.list({ limit: 200 }).then(r => setDepartments(r.data)).catch(() => {})
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
    if (selectedDepartment) {
      params.department_id = selectedDepartment
      params.include_group = false
    }
    if (selectedSemester) params.semester = selectedSemester
    if (selectedYearLevel) params.year_level = selectedYearLevel
    list.setExtraParams(params)
  }, [selectedDepartment, selectedSemester, selectedYearLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCollegeChange(value: string) {
    setSelectedCollege(value)
    setSelectedDepartment('')
  }

  function clearFilters() {
    setSelectedCollege('')
    setSelectedDepartment('')
    setSelectedSemester('')
    setSelectedYearLevel('')
  }

  function openCreateModal() {
    setFormMode('create')
    setEditTarget(null)
    setForm({
      code: '',
      title: '',
      description: '',
      units: 3,
      lectureHours: 0,
      labHours: 0,
      type: 'lecture',
      departmentId: 0,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function openEditModal(subject: Subject) {
    setFormMode('edit')
    setEditTarget(subject)
    setForm({
      code: subject.code,
      title: subject.title,
      description: subject.description || '',
      units: subject.units,
      lectureHours: subject.lectureHours,
      labHours: subject.labHours,
      type: subject.type,
      yearLevel: subject.yearLevel ?? undefined,
      semester: subject.semester ?? undefined,
      departmentId: subject.department?.id || 0,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function closeFormModal() {
    if (formSaving) return
    setFormOpen(false)
  }

  function updateForm(field: keyof SubjectInput, value: string | number | undefined) {
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
    if (!form.title?.trim()) nextErrors.title = 'Title is required.'
    if (!form.departmentId) nextErrors.departmentId = 'Department is required.'
    if ((form.units ?? 0) < 1 || (form.units ?? 0) > 12) nextErrors.units = 'Units must be between 1 and 12.'

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
        await subjectsApi.create(form)
      } else if (editTarget) {
        await subjectsApi.update(editTarget.id, form)
      }

      setFormOpen(false)
      list.refresh()
    } catch {
      setActionError(formMode === 'create' ? 'Failed to create subject.' : 'Failed to update subject.')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await subjectsApi.delete(deleteTarget.id); setDeleteTarget(null); list.refresh() } catch { setActionError('Failed to delete subject.') } finally { setDeleting(false) }
  }

  const columns: Column<Subject>[] = [
    { key: 'code', header: 'Code', sortable: true, render: (s) => <span className="font-medium text-gray-900 dark:text-white">{s.code}</span> },
    { key: 'title', header: 'Title', sortable: true, render: (s) => s.title },
    { key: 'units', header: 'Units', sortable: true, render: (s) => s.units },
    { key: 'type', header: 'Type', render: (s) => <Badge variant={s.type === 'laboratory' ? 'warning' : s.type === 'lecture-lab' ? 'purple' : 'primary'}>{s.type}</Badge> },
    { key: 'department', header: 'Department', render: (s) => s.department?.name || '—' },
    { key: 'isActive', header: 'Status', sortable: true, render: (s) => <Badge variant={s.isActive ? 'success' : 'default'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/subjects/${s.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Eye className="h-4 w-4 text-gray-500" /></Link>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(s) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subjects</h1>
          <p className="mt-1 text-sm text-gray-500">Manage subjects and courses.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Subject</Button>
      </div>

      {actionError && <Alert variant="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search subjects..." className="max-w-sm" />
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
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Semesters</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s === '1st' ? '1st Semester' : s === '2nd' ? '2nd Semester' : s}</option>)}
              </select>
              <select
                value={selectedYearLevel}
                onChange={(e) => setSelectedYearLevel(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Year Levels</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
              {(selectedCollege || selectedDepartment || selectedSemester || selectedYearLevel) && (
                <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 whitespace-nowrap">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(s) => s.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(s) => router.push(`/admin/subjects/${s.id}`)} emptyTitle="No subjects found" emptyAction={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Add Subject</Button>} />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Subject" variant="danger" confirmLabel="Delete" message={`Are you sure you want to delete "${deleteTarget?.title}"?`} />

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formMode === 'create' ? 'Add Subject' : 'Edit Subject'}
        description={formMode === 'create' ? 'Create a new subject.' : `Update ${editTarget?.code || 'subject'} details.`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" type="button" onClick={closeFormModal} disabled={formSaving}>Cancel</Button>
            <Button type="submit" form="subject-modal-form" loading={formSaving}>
              {formMode === 'create' ? 'Create Subject' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        <form id="subject-modal-form" onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Code"
              required
              value={form.code || ''}
              onChange={(e) => updateForm('code', e.target.value)}
              error={formErrors.code}
              placeholder="e.g. CS101"
            />
            <Input
              label="Title"
              required
              value={form.title || ''}
              onChange={(e) => updateForm('title', e.target.value)}
              error={formErrors.title}
              placeholder="Subject title"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Units"
              type="number"
              min={1}
              max={12}
              value={form.units ?? 3}
              onChange={(e) => updateForm('units', Number(e.target.value))}
              error={formErrors.units}
            />
            <Input
              label="Lecture Hours"
              type="number"
              min={0}
              value={form.lectureHours ?? 0}
              onChange={(e) => updateForm('lectureHours', Number(e.target.value))}
            />
            <Input
              label="Lab Hours"
              type="number"
              min={0}
              value={form.labHours ?? 0}
              onChange={(e) => updateForm('labHours', Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Type"
              value={form.type || ''}
              onChange={(e) => updateForm('type', e.target.value)}
              options={SUBJECT_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              placeholder="Select type"
            />
            <Select
              label="Year Level"
              value={form.yearLevel ? String(form.yearLevel) : ''}
              onChange={(e) => updateForm('yearLevel', e.target.value ? Number(e.target.value) : undefined)}
              options={[{ value: '', label: 'Any' }, ...[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` }))]}
            />
            <Select
              label="Semester"
              value={form.semester || ''}
              onChange={(e) => updateForm('semester', e.target.value || undefined)}
              options={[{ value: '', label: 'Any' }, ...SEMESTERS.map((s) => ({ value: s, label: s === '1st' ? '1st Semester' : s === '2nd' ? '2nd Semester' : s }))]}
            />
          </div>

          <Select
            label="Department"
            value={form.departmentId ? String(form.departmentId) : ''}
            onChange={(e) => updateForm('departmentId', e.target.value ? Number(e.target.value) : 0)}
            options={[{ value: '', label: 'Select department' }, ...departments.map((d) => ({ value: String(d.id), label: d.name }))]}
            error={formErrors.departmentId}
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
