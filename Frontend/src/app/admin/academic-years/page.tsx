'use client'

import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Star, Calendar, CheckCircle, XCircle, CalendarCheck, Power, ArrowRightLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { useCrudList } from '@/hooks/useCrudList'
import { academicYearsApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import { SEMESTERS } from '@/lib/constants'
import type { AcademicYear, AcademicYearInput } from '@/types'

const semesterOptions = [{ value: '', label: '-- Select Semester --' }, ...SEMESTERS.map(s => ({ value: s, label: `${s} Semester` }))]

export default function AcademicYearsPage() {
  const router = useRouter()
  const list = useCrudList<AcademicYear>((p) => academicYearsApi.list(p))
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number; current: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<AcademicYear | null>(null)
  const [form, setForm] = useState<AcademicYearInput>({ year: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)
  const [formServerError, setFormServerError] = useState('')

  // Set as Current modal state
  const [setCurrentTarget, setSetCurrentTarget] = useState<AcademicYear | null>(null)
  const [setCurrentSemester, setSetCurrentSemester] = useState('')
  const [setCurrentLoading, setSetCurrentLoading] = useState(false)
  const [setCurrentError, setSetCurrentError] = useState('')

  // Switch semester modal state
  const [switchSemTarget, setSwitchSemTarget] = useState<AcademicYear | null>(null)
  const [switchSemValue, setSwitchSemValue] = useState('')
  const [switchSemLoading, setSwitchSemLoading] = useState(false)
  const [switchSemError, setSwitchSemError] = useState('')

  const refreshAll = () => { list.refresh(); academicYearsApi.stats().then(setStats).catch(() => {}) }

  useEffect(() => { academicYearsApi.stats().then(setStats).catch(() => {}) }, [])

  function openCreateModal() {
    setFormMode('create')
    setEditTarget(null)
    setForm({ year: '' })
    setFormErrors({})
    setFormServerError('')
    setFormOpen(true)
  }

  function normalizeDate(dateValue?: string | null): string | undefined {
    if (!dateValue) return undefined
    return dateValue.split('T')[0]
  }

  function openEditModal(ay: AcademicYear) {
    setFormMode('edit')
    setEditTarget(ay)
    setForm({
      year: ay.year,
      currentSemester: ay.currentSemester || undefined,
      isCurrent: ay.isCurrent,
      startDate: normalizeDate(ay.startDate),
      endDate: normalizeDate(ay.endDate),
      firstSemStart: normalizeDate(ay.firstSemStart),
      firstSemEnd: normalizeDate(ay.firstSemEnd),
      secondSemStart: normalizeDate(ay.secondSemStart),
      secondSemEnd: normalizeDate(ay.secondSemEnd),
      summerStart: normalizeDate(ay.summerStart),
      summerEnd: normalizeDate(ay.summerEnd),
    })
    setFormErrors({})
    setFormServerError('')
    setFormOpen(true)
  }

  function closeFormModal() {
    if (formSaving) return
    setFormOpen(false)
  }

  const setFormField = (field: keyof AcademicYearInput, value: string | boolean | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validateForm(): boolean {
    const nextErrors: Record<string, string> = {}
    if (!form.year?.trim()) nextErrors.year = 'Year is required (e.g. 2025-2026).'
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    setFormSaving(true)
    setFormServerError('')
    try {
      if (formMode === 'create') {
        await academicYearsApi.create(form)
      } else if (editTarget) {
        await academicYearsApi.update(editTarget.id, form)
      }

      setFormOpen(false)
      refreshAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setFormServerError(msg || (formMode === 'create' ? 'Failed to create academic year.' : 'Failed to update academic year.'))
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await academicYearsApi.delete(deleteId); refreshAll() } catch { /* */ }
    setDeleteId(null)
  }

  async function handleSetCurrent() {
    if (!setCurrentTarget) return
    if (!setCurrentSemester) { setSetCurrentError('Please select a semester.'); return }
    setSetCurrentLoading(true)
    setSetCurrentError('')
    try {
      await academicYearsApi.setCurrent(setCurrentTarget.id, setCurrentSemester)
      setSetCurrentTarget(null)
      setSetCurrentSemester('')
      refreshAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setSetCurrentError(msg || 'Failed to set as current.')
    } finally {
      setSetCurrentLoading(false)
    }
  }

  async function handleSwitchSemester() {
    if (!switchSemTarget || !switchSemValue) return
    setSwitchSemLoading(true)
    setSwitchSemError('')
    try {
      await academicYearsApi.setSemester(switchSemTarget.id, switchSemValue)
      setSwitchSemTarget(null)
      setSwitchSemValue('')
      refreshAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setSwitchSemError(msg || 'Failed to switch semester.')
    } finally {
      setSwitchSemLoading(false)
    }
  }

  async function handleToggleStatus(ay: AcademicYear) {
    try { await academicYearsApi.toggleStatus(ay.id); refreshAll() } catch { /* */ }
  }

  const columns: Column<AcademicYear>[] = [
    {
      key: 'year', header: 'Academic Year', sortable: true,
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">{a.year}</span>
          {a.isCurrent && <Badge variant="success">Current</Badge>}
        </div>
      ),
    },
    {
      key: 'currentSemester', header: 'Active Semester',
      render: (a) => a.isCurrent && a.currentSemester
        ? <Badge variant="primary">{a.currentSemester} Semester</Badge>
        : <span className="text-gray-400">—</span>,
    },
    { key: 'startDate', header: 'Start', sortable: true, render: (a) => a.startDate ? formatDate(a.startDate) : '—' },
    { key: 'endDate', header: 'End', render: (a) => a.endDate ? formatDate(a.endDate) : '—' },
    {
      key: 'isActive', header: 'Status', sortable: true,
      render: (a) => <Badge variant={a.isActive ? 'success' : 'default'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (a) => (
        <div className="flex items-center gap-1">
          {/* Set as Current (only for non-current active years) */}
          {!a.isCurrent && a.isActive && (
            <button onClick={(e) => { e.stopPropagation(); setSetCurrentTarget(a); setSetCurrentSemester(''); setSetCurrentError('') }} className="p-1.5 rounded hover:bg-yellow-50" title="Set as current">
              <Star className="h-4 w-4 text-yellow-500" />
            </button>
          )}
          {/* Switch Semester (only for current year) */}
          {a.isCurrent && (
            <button onClick={(e) => { e.stopPropagation(); setSwitchSemTarget(a); setSwitchSemValue(''); setSwitchSemError('') }} className="p-1.5 rounded hover:bg-blue-50" title="Switch semester">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            </button>
          )}
          {/* Toggle active/inactive */}
          <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(a) }} className={`p-1.5 rounded ${a.isActive ? 'hover:bg-orange-50' : 'hover:bg-green-50'}`} title={a.isActive ? 'Deactivate' : 'Activate'}>
            <Power className={`h-4 w-4 ${a.isActive ? 'text-orange-500' : 'text-green-500'}`} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(a) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500" /></button>
          {!a.isCurrent && (
            <button onClick={(e) => { e.stopPropagation(); setDeleteId(a.id) }} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-500" /></button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Academic Years</h1><p className="mt-1 text-sm text-gray-500">Manage academic years and semesters.</p></div>
        <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" />Add Academic Year</Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Years</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Calendar className="h-6 w-6 text-blue-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><CheckCircle className="h-6 w-6 text-green-500" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg"><XCircle className="h-6 w-6 text-gray-400" /></div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Current Year</p>
                <p className="text-2xl font-bold text-amber-600">{stats.current}</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg"><CalendarCheck className="h-6 w-6 text-amber-500" /></div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="mb-4"><SearchBar value={list.search} onChange={list.setSearch} placeholder="Search academic years..." className="max-w-sm" /></div>
        <DataTable columns={columns} data={list.data} keyExtractor={(a) => a.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(a) => openEditModal(a)} emptyTitle="No academic years found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      {/* Delete confirmation */}
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Academic Year" confirmLabel="Delete" variant="danger" message="Are you sure you want to delete this academic year? This action cannot be undone." />

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formMode === 'create' ? 'Add Academic Year' : 'Edit Academic Year'}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" type="button" onClick={closeFormModal} disabled={formSaving}>Cancel</Button>
            <Button type="submit" form="academic-year-modal-form" loading={formSaving}>
              {formMode === 'create' ? 'Create Academic Year' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        {formServerError && <Alert variant="error">{formServerError}</Alert>}
        <form id="academic-year-modal-form" onSubmit={handleSubmitForm} className="space-y-4 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Year"
              required
              placeholder="2025-2026"
              value={form.year || ''}
              onChange={(e) => setFormField('year', e.target.value)}
              error={formErrors.year}
            />
            <Select
              label="Current Semester"
              value={form.currentSemester || ''}
              onChange={(e) => setFormField('currentSemester', e.target.value || undefined)}
              options={semesterOptions}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Overall Start Date" value={form.startDate || ''} onChange={(v) => setFormField('startDate', v || undefined)} />
            <DatePicker label="Overall End Date" value={form.endDate || ''} onChange={(v) => setFormField('endDate', v || undefined)} minDate={form.startDate} />
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isCurrent ?? false}
                onChange={(e) => setFormField('isCurrent', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ms-2 text-sm font-medium text-gray-700 dark:text-gray-300">Set as Current Year</span>
            </label>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">1st Semester Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Start" value={form.firstSemStart || ''} onChange={(v) => setFormField('firstSemStart', v || undefined)} />
            <DatePicker label="End" value={form.firstSemEnd || ''} onChange={(v) => setFormField('firstSemEnd', v || undefined)} minDate={form.firstSemStart} />
          </div>

          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">2nd Semester Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Start" value={form.secondSemStart || ''} onChange={(v) => setFormField('secondSemStart', v || undefined)} />
            <DatePicker label="End" value={form.secondSemEnd || ''} onChange={(v) => setFormField('secondSemEnd', v || undefined)} minDate={form.secondSemStart} />
          </div>

          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">Summer Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Start" value={form.summerStart || ''} onChange={(v) => setFormField('summerStart', v || undefined)} />
            <DatePicker label="End" value={form.summerEnd || ''} onChange={(v) => setFormField('summerEnd', v || undefined)} minDate={form.summerStart} />
          </div>
        </form>
      </Modal>

      {/* Set as Current modal */}
      <Modal open={!!setCurrentTarget} onClose={() => setSetCurrentTarget(null)} title="Set as Current Academic Year" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set <strong>{setCurrentTarget?.year}</strong> as the current academic year. Please select which semester to activate.
          </p>
          {setCurrentError && <Alert variant="error">{setCurrentError}</Alert>}
          <Select label="Semester" value={setCurrentSemester} onChange={e => setSetCurrentSemester(e.target.value)} options={semesterOptions} />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSetCurrentTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
            <button type="button" onClick={handleSetCurrent} disabled={setCurrentLoading} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {setCurrentLoading ? 'Setting...' : 'Set as Current'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Switch Semester modal */}
      <Modal open={!!switchSemTarget} onClose={() => setSwitchSemTarget(null)} title="Switch Active Semester" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Change the active semester for <strong>{switchSemTarget?.year}</strong>.
            {switchSemTarget?.currentSemester && (
              <> Currently set to <Badge variant="primary">{switchSemTarget.currentSemester} Semester</Badge>.</>
            )}
          </p>
          {switchSemError && <Alert variant="error">{switchSemError}</Alert>}
          <Select label="New Semester" value={switchSemValue} onChange={e => setSwitchSemValue(e.target.value)} options={semesterOptions} />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSwitchSemTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
            <button type="button" onClick={handleSwitchSemester} disabled={switchSemLoading || !switchSemValue} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {switchSemLoading ? 'Switching...' : 'Switch Semester'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
