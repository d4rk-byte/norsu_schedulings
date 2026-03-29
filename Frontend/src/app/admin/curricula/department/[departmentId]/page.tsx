'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CheckCircle, BookOpen, Upload, X, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { curriculaApi, departmentsApi, academicYearsApi } from '@/lib/admin-api'
import type { Curriculum, CurriculumInput, Department } from '@/types'

export default function DepartmentCurriculaPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = use(params)
  const router = useRouter()
  const [department, setDepartment] = useState<Department | null>(null)
  const [deptLoading, setDeptLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Curriculum | null>(null)
  const [form, setForm] = useState<CurriculumInput>({ name: '', departmentId: Number(departmentId) })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)
  const [years, setYears] = useState<{ id: number; year: string }[]>([])

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadVersion, setUploadVersion] = useState(1)
  const [uploadAutoTerms, setUploadAutoTerms] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message?: string; subjects_added?: number; terms_created?: number; errors?: string[] } | null>(null)

  // Stats
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 })

  const list = useCrudList<Curriculum>((p) => curriculaApi.list({ ...p, department_id: departmentId }))

  useEffect(() => {
    departmentsApi.get(Number(departmentId))
      .then(d => setDepartment(d))
      .catch(() => setError('Department not found.'))
      .finally(() => setDeptLoading(false))
  }, [departmentId])

  useEffect(() => {
    academicYearsApi.list({ limit: 200 }).then((y) => {
      setYears(y.data.map((item) => ({ id: item.id, year: item.year })))
    }).catch(() => {})
  }, [])

  // Compute stats from list data
  useEffect(() => {
    if (list.data.length > 0 || !list.loading) {
      const published = list.data.filter(c => c.isPublished).length
      setStats({ total: list.meta.total || list.data.length, published, draft: list.data.length - published })
    }
  }, [list.data, list.loading, list.meta.total])

  async function handleDelete() {
    if (!deleteId) return
    try { await curriculaApi.delete(deleteId); list.refresh() } catch { /* */ }
    setDeleteId(null)
  }

  async function publish(id: number) {
    try { await curriculaApi.publish(id); list.refresh() } catch { /* */ }
  }

  function openCreateModal() {
    setFormMode('create')
    setEditTarget(null)
    setForm({
      name: '',
      version: 1,
      notes: '',
      departmentId: Number(departmentId),
      effectiveYearId: undefined,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function openEditModal(curriculum: Curriculum) {
    setFormMode('edit')
    setEditTarget(curriculum)
    setForm({
      name: curriculum.name,
      version: curriculum.version,
      notes: curriculum.notes || '',
      departmentId: curriculum.department?.id || Number(departmentId),
      effectiveYearId: curriculum.effectiveYearId || undefined,
      isPublished: curriculum.isPublished,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function closeFormModal() {
    if (formSaving) return
    setFormOpen(false)
  }

  function updateForm(field: keyof CurriculumInput, value: string | number | boolean | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validateForm(): boolean {
    const nextErrors: Record<string, string> = {}
    if (!form.name?.trim()) nextErrors.name = 'Curriculum name is required.'
    if (!form.departmentId) nextErrors.departmentId = 'Department is required.'
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    setFormSaving(true)
    setError('')
    try {
      if (formMode === 'create') {
        await curriculaApi.create(form)
      } else if (editTarget) {
        await curriculaApi.update(editTarget.id, form)
      }

      setFormOpen(false)
      list.refresh()
    } catch {
      setError(formMode === 'create' ? 'Failed to create curriculum.' : 'Failed to update curriculum.')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName) return
    setUploading(true)
    setUploadResult(null)
    try {
      const result = await curriculaApi.bulkUpload(uploadFile, uploadName, uploadVersion, Number(departmentId), uploadAutoTerms)
      setUploadResult({ success: true, message: 'Curriculum uploaded!', subjects_added: result.subjects_added, terms_created: result.terms_created, errors: result.errors })
      setUploadFile(null)
      setUploadName('')
      setUploadVersion(1)
      list.refresh()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Upload failed.'
      setUploadResult({ success: false, message: msg })
    }
    setUploading(false)
  }

  async function handleDownloadTemplate() {
    try {
      const data = await curriculaApi.downloadTemplate()
      const blob = new Blob([data.content], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download template.')
    }
  }

  const columns: Column<Curriculum>[] = [
    { key: 'name', header: 'Curriculum', sortable: true, render: (c) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'version', header: 'Version', sortable: true, render: (c) => `v${c.version}` },
    { key: 'totalSubjects', header: 'Subjects', render: (c) => c.totalSubjects || 0 },
    { key: 'totalUnits', header: 'Units', render: (c) => c.totalUnits || 0 },
    { key: 'isPublished', header: 'Status', sortable: true, render: (c) => <Badge variant={c.isPublished ? 'success' : 'warning'}>{c.isPublished ? 'Published' : 'Draft'}</Badge> },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (c) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/curricula/${c.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100"><Eye className="h-4 w-4 text-gray-500" /></Link>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(c) }} className="p-1.5 rounded hover:bg-gray-100"><Pencil className="h-4 w-4 text-gray-500" /></button>
          {!c.isPublished && <button onClick={(e) => { e.stopPropagation(); publish(c.id) }} className="p-1.5 rounded hover:bg-green-50" title="Publish"><CheckCircle className="h-4 w-4 text-green-500" /></button>}
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(c.id) }} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ]

  if (deptLoading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error && !department) return <Alert variant="error">{error}</Alert>
  if (!department) return <Alert variant="error">Department not found.</Alert>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/curricula" className="p-2 rounded hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{department.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{department.code} &bull; {department.college?.name || 'No College'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => { setShowUpload(true); setUploadResult(null); setUploadFile(null) }}>
            <Upload className="h-4 w-4 mr-2" />Upload Curriculum
          </Button>
          <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" />Add Curriculum</Button>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Curricula</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg"><BookOpen className="h-6 w-6 text-indigo-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Published</p>
              <p className="text-2xl font-bold text-green-600">{stats.published}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg"><CheckCircle className="h-6 w-6 text-green-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Draft</p>
              <p className="text-2xl font-bold text-amber-600">{stats.draft}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg"><Pencil className="h-6 w-6 text-amber-500" /></div>
          </div>
        </Card>
      </div>

      {/* Curricula Table */}
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search curricula..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(c) => c.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(c) => router.push(`/admin/curricula/${c.id}`)} emptyTitle="No curricula found" emptyDescription="Get started by adding a curriculum for this department." />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      {/* Delete Confirmation */}
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Curriculum" confirmLabel="Delete" variant="danger" message="Are you sure you want to delete this curriculum?" />

      {/* Curriculum Form Modal */}
      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formMode === 'create' ? 'Add Curriculum' : 'Edit Curriculum'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal} disabled={formSaving}>Cancel</Button>
            <Button type="submit" form="curriculum-form" loading={formSaving}>{formMode === 'create' ? 'Create Curriculum' : 'Save Changes'}</Button>
          </>
        }
      >
        <form id="curriculum-form" onSubmit={handleSubmitForm} className="space-y-4">
          <Input
            label="Curriculum Name"
            value={form.name || ''}
            onChange={(e) => updateForm('name', e.target.value)}
            error={formErrors.name}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Version"
              type="number"
              min={1}
              value={form.version ?? 1}
              onChange={(e) => updateForm('version', Number(e.target.value) || 1)}
            />

            <Select
              label="Effective Academic Year"
              value={form.effectiveYearId ? String(form.effectiveYearId) : ''}
              onChange={(e) => updateForm('effectiveYearId', e.target.value ? Number(e.target.value) : undefined)}
              options={[
                { value: '', label: 'Select academic year (optional)' },
                ...years.map((y) => ({ value: String(y.id), label: y.year })),
              ]}
            />
          </div>

          <Textarea
            label="Notes"
            rows={4}
            value={form.notes || ''}
            onChange={(e) => updateForm('notes', e.target.value)}
          />
        </form>
      </Modal>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-blue-900">Upload Curriculum</h3>
                <p className="text-sm text-blue-700 mt-1">Import subjects from Excel or CSV to create a new curriculum</p>
              </div>
              <button onClick={() => setShowUpload(false)} className="p-1.5 rounded hover:bg-blue-200"><X className="h-5 w-5 text-blue-800" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Curriculum Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum Name <span className="text-red-500">*</span></label>
                <input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g., Bachelor of Science in Information Technology" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" />
              </div>
              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                <input type="number" min={1} value={uploadVersion} onChange={e => setUploadVersion(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" />
              </div>
              {/* Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">File Format</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>&bull; <strong>Formats:</strong> Excel (.xlsx, .xls) or CSV (.csv)</li>
                  <li>&bull; <strong>Required columns:</strong> Code, Title, Units, Lec, Lab, Year Level, Semester</li>
                  <li>&bull; <strong>Optional columns:</strong> Type, Required (yes/no)</li>
                </ul>
              </div>
              {/* Download template */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Download Template</p>
                    <p className="text-xs text-gray-600">CSV template with examples</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleDownloadTemplate}><Download className="h-4 w-4 mr-1" />Download</Button>
              </div>
              {/* File */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${uploadFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                onClick={() => document.getElementById('deptUploadFileInput')?.click()}
              >
                <input type="file" id="deptUploadFileInput" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = '' }} />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setUploadFile(null) }} className="p-1 rounded hover:bg-red-50"><X className="h-4 w-4 text-red-500" /></button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-9 w-9 text-gray-400" />
                    <p className="mt-2 text-sm font-medium text-gray-900">Click to select file</p>
                    <p className="mt-1 text-xs text-gray-500">Excel (.xlsx, .xls) or CSV (.csv) up to 10MB</p>
                  </>
                )}
              </div>
              {/* Options */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={uploadAutoTerms} onChange={e => setUploadAutoTerms(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Auto-create terms from year level and semester</span>
              </label>
              {/* Result */}
              {uploadResult && (
                <div className={`rounded-lg p-4 ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {uploadResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>{uploadResult.message}</p>
                      {uploadResult.success && <p className="text-sm text-green-700 mt-1">{uploadResult.subjects_added ?? 0} subjects added, {uploadResult.terms_created ?? 0} terms created</p>}
                      {uploadResult.errors && uploadResult.errors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
                          {uploadResult.errors.map((err, i) => <li key={i}>&bull; {err}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <Button variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || !uploadName || uploading}>{uploading ? 'Uploading...' : 'Upload'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
