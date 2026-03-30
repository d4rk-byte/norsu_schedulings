'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, BookOpen, X, CalendarDays, GraduationCap, Layers, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmModal } from '@/components/ui/Modal'
import { curriculaApi, subjectsApi } from '@/lib/admin-api'
import type { Curriculum, CurriculumTerm } from '@/types'

export default function ManageCurriculumSubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Generate terms modal
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateYears, setGenerateYears] = useState(4)

  // Add term modal
  const [showAddTermModal, setShowAddTermModal] = useState(false)
  const [newTermYear, setNewTermYear] = useState(1)
  const [newTermSemester, setNewTermSemester] = useState('1st')
  const [newTermName, setNewTermName] = useState('')

  // Delete term
  const [deleteTermId, setDeleteTermId] = useState<number | null>(null)

  // Add subject modal
  const [addSubjectTermId, setAddSubjectTermId] = useState<number | null>(null)
  const [newSubjectForm, setNewSubjectForm] = useState({
    code: '',
    title: '',
    description: '',
    units: 3,
    lectureHours: 3,
    labHours: 0,
    type: 'lecture',
    yearLevel: 1,
    semester: '1st',
  })

  // Remove subject
  const [removeSubjectId, setRemoveSubjectId] = useState<number | null>(null)

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [autoCreateTerms, setAutoCreateTerms] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message?: string; subjects_added?: number; terms_created?: number; errors?: string[] } | null>(null)

  const loadCurriculum = useCallback(async () => {
    try {
      const data = await curriculaApi.get(Number(id))
      setCurriculum(data)
    } catch {
      setError('Failed to load curriculum.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadCurriculum() }, [loadCurriculum])

  useEffect(() => {
    if (addSubjectTermId === null) return

    const selectedTerm = terms.find(t => t.id === addSubjectTermId)
    setNewSubjectForm(prev => ({
      ...prev,
      yearLevel: selectedTerm?.yearLevel ?? 1,
      semester: selectedTerm?.semester ?? '1st',
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSubjectTermId])

  async function handleGenerateTerms() {
    setActionLoading(true)
    setError('')
    try {
      const data = await curriculaApi.generateTerms(Number(id), generateYears)
      setCurriculum(data)
      setShowGenerateModal(false)
    } catch {
      setError('Failed to generate terms.')
    }
    setActionLoading(false)
  }

  async function handleAddTerm() {
    setActionLoading(true)
    setError('')
    try {
      const data = await curriculaApi.addTerm(Number(id), {
        yearLevel: newTermYear,
        semester: newTermSemester,
        termName: newTermName || undefined,
      })
      setCurriculum(data)
      setShowAddTermModal(false)
      setNewTermYear(1)
      setNewTermSemester('1st')
      setNewTermName('')
    } catch {
      setError('Failed to add term. It may already exist.')
    }
    setActionLoading(false)
  }

  async function handleDeleteTerm() {
    if (!deleteTermId) return
    setActionLoading(true)
    setError('')
    try {
      const data = await curriculaApi.deleteTerm(deleteTermId)
      setCurriculum(data)
    } catch {
      setError('Failed to delete term.')
    }
    setDeleteTermId(null)
    setActionLoading(false)
  }

  function resetNewSubjectForm() {
    setNewSubjectForm({
      code: '',
      title: '',
      description: '',
      units: 3,
      lectureHours: 3,
      labHours: 0,
      type: 'lecture',
      yearLevel: 1,
      semester: '1st',
    })
  }

  async function handleAddSubject() {
    if (!addSubjectTermId) return
    if (!curriculum) {
      setError('Curriculum is not loaded yet. Please refresh and try again.')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const createdSubject = await subjectsApi.create({
        code: newSubjectForm.code.trim(),
        title: newSubjectForm.title.trim(),
        description: newSubjectForm.description.trim() || undefined,
        units: Number(newSubjectForm.units),
        lectureHours: Number(newSubjectForm.lectureHours),
        labHours: Number(newSubjectForm.labHours),
        type: newSubjectForm.type,
        yearLevel: Number(newSubjectForm.yearLevel),
        semester: newSubjectForm.semester,
        departmentId: curriculum.department.id,
      })

      const data = await curriculaApi.addSubjectToTerm(addSubjectTermId, createdSubject.id)
      setCurriculum(data)
      setAddSubjectTermId(null)
      resetNewSubjectForm()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg || 'Failed to add subject. Please check the form fields and try again.')
    }

    setActionLoading(false)
  }

  async function handleRemoveSubject() {
    if (!removeSubjectId) return
    setActionLoading(true)
    setError('')
    try {
      const data = await curriculaApi.removeSubjectFromTerm(removeSubjectId)
      setCurriculum(data)
    } catch {
      setError('Failed to remove subject.')
    }
    setRemoveSubjectId(null)
    setActionLoading(false)
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

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    try {
      const result = await curriculaApi.uploadSubjects(Number(id), uploadFile, autoCreateTerms)
      setUploadResult({ success: true, message: 'Upload successful!', subjects_added: result.subjects_added, terms_created: result.terms_created, errors: result.errors })
      if (result.data) setCurriculum(result.data)
      setUploadFile(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string }; details?: { errors?: string[] } } } })?.response?.data?.error?.message || 'Upload failed.'
      const errors = (err as { response?: { data?: { details?: { errors?: string[] } } } })?.response?.data?.details?.errors
      setUploadResult({ success: false, message: msg, errors })
    }
    setUploading(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error && !curriculum) return <Alert variant="error">{error}</Alert>
  if (!curriculum) return <Alert variant="error">Curriculum not found.</Alert>

  const terms = curriculum.curriculumTerms ?? []
  const totalSubjects = terms.reduce((acc, t) => acc + (t.curriculumSubjects?.length || 0), 0)
  const totalUnits = terms.reduce((acc, t) => acc + t.totalUnits, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/admin/curricula/${id}`} className="p-2 rounded hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Subjects</h1>
            <p className="mt-1 text-sm text-gray-500">
              {curriculum.name} &mdash; v{curriculum.version} &mdash;{' '}
              <Badge variant={curriculum.isPublished ? 'success' : 'warning'}>
                {curriculum.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </p>
          </div>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* Draft warning */}
      {!curriculum.isPublished && (
        <div className="rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Draft Mode:</strong> This curriculum is unpublished. Subjects won&apos;t appear in published views until you publish it.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Terms</p>
              <p className="text-2xl font-bold text-gray-900">{terms.length}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg"><CalendarDays className="h-6 w-6 text-indigo-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Subjects</p>
              <p className="text-2xl font-bold text-indigo-600">{totalSubjects}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg"><BookOpen className="h-6 w-6 text-indigo-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg"><Layers className="h-6 w-6 text-indigo-500" /></div>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowGenerateModal(true)} disabled={actionLoading}>
            <Plus className="h-4 w-4 mr-2" />Generate Default Terms
          </Button>
          <Button variant="secondary" onClick={() => setShowAddTermModal(true)} disabled={actionLoading}>
            <Plus className="h-4 w-4 mr-2" />Add Custom Term
          </Button>
          <Button variant="secondary" onClick={() => { setShowUploadModal(true); setUploadResult(null); setUploadFile(null) }} disabled={actionLoading}>
            <Upload className="h-4 w-4 mr-2" />Upload Curriculum
          </Button>
        </div>
      </Card>

      {/* Terms List */}
      {terms.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No terms created yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by generating default terms or adding a custom term.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {terms.map((term: CurriculumTerm) => (
            <Card key={term.id} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 -mx-6 -mt-6 px-6 py-4 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{term.displayName}</h3>
                  <p className="text-sm text-gray-500">{term.curriculumSubjects?.length || 0} subjects &middot; {term.totalUnits} units</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setAddSubjectTermId(term.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add Subject
                  </Button>
                  <button onClick={() => setDeleteTermId(term.id)} className="p-1.5 rounded hover:bg-red-50" title="Delete term">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>

              {term.curriculumSubjects?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 font-medium">Code</th>
                        <th className="pb-2 font-medium">Title</th>
                        <th className="pb-2 font-medium">Units</th>
                        <th className="pb-2 font-medium">Lec</th>
                        <th className="pb-2 font-medium">Lab</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {term.curriculumSubjects.map(cs => (
                        <tr key={cs.id} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{cs.subject.code}</td>
                          <td className="py-2">{cs.subject.title}</td>
                          <td className="py-2">{cs.subject.units}</td>
                          <td className="py-2">{cs.subject.lectureHours}</td>
                          <td className="py-2">{cs.subject.labHours}</td>
                          <td className="py-2">
                            <Badge variant={cs.subject.type === 'laboratory' ? 'warning' : cs.subject.type === 'lecture-lab' ? 'purple' : 'default'}>
                              {cs.subject.type}
                            </Badge>
                          </td>
                          <td className="py-2">
                            <button onClick={() => setRemoveSubjectId(cs.id)} className="p-1 rounded hover:bg-red-50" title="Remove">
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 flex items-center gap-1 py-4">
                  <BookOpen className="h-4 w-4" />No subjects assigned to this term yet.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Generate Terms Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowGenerateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Default Terms</h3>
            <p className="text-sm text-gray-600 mb-4">This will create terms for each year level and semester (1st &amp; 2nd). Existing terms won&apos;t be duplicated.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Years</label>
              <select
                value={generateYears}
                onChange={e => setGenerateYears(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                {[2, 3, 4, 5, 6].map(y => <option key={y} value={y}>{y} years ({y * 2} terms)</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
              <Button onClick={handleGenerateTerms} disabled={actionLoading}>{actionLoading ? 'Generating...' : 'Generate'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Term Modal */}
      {showAddTermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddTermModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Custom Term</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                <select value={newTermYear} onChange={e => setNewTermYear(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none">
                  {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                <select value={newTermSemester} onChange={e => setNewTermSemester(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none">
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                  <option value="summer">Summer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Name (optional)</label>
                <input value={newTermName} onChange={e => setNewTermName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" placeholder="e.g. Midyear" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowAddTermModal(false)}>Cancel</Button>
              <Button onClick={handleAddTerm} disabled={actionLoading}>{actionLoading ? 'Adding...' : 'Add Term'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subject to Term Modal */}
      {addSubjectTermId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddSubjectTermId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Subject to Term</h3>
              <button onClick={() => setAddSubjectTermId(null)} className="p-1.5 rounded hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Create a new subject for this curriculum term.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                <input
                  value={newSubjectForm.code}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g., IT101"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Title</label>
                <input
                  value={newSubjectForm.title}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g., Introduction to Information Technology"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={newSubjectForm.description}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  placeholder="Brief description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newSubjectForm.units}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, units: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lec Hours</label>
                <input
                  type="number"
                  min={0}
                  value={newSubjectForm.lectureHours}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, lectureHours: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lab Hours</label>
                <input
                  type="number"
                  min={0}
                  value={newSubjectForm.labHours}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, labHours: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newSubjectForm.type}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="lecture">Lecture</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="lecture_lab">Lecture + Lab</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                <select
                  value={newSubjectForm.yearLevel}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, yearLevel: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6].map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                <select
                  value={newSubjectForm.semester}
                  onChange={e => setNewSubjectForm(prev => ({ ...prev, semester: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                  <option value="summer">Summer</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setAddSubjectTermId(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleAddSubject}
                disabled={actionLoading || !newSubjectForm.code.trim() || !newSubjectForm.title.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />{actionLoading ? 'Adding...' : 'Add Subject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Term Confirmation */}
      <ConfirmModal
        open={!!deleteTermId}
        onClose={() => setDeleteTermId(null)}
        onConfirm={handleDeleteTerm}
        title="Delete Term"
        confirmLabel="Delete"
        variant="danger"
        message="This will delete the term and all its subject assignments. This cannot be undone."
      />

      {/* Remove Subject Confirmation */}
      <ConfirmModal
        open={!!removeSubjectId}
        onClose={() => setRemoveSubjectId(null)}
        onConfirm={handleRemoveSubject}
        title="Remove Subject"
        confirmLabel="Remove"
        variant="danger"
        message="Remove this subject from the term?"
      />

      {/* Upload Curriculum Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-blue-900">Upload Curriculum</h3>
                <p className="text-sm text-blue-700 mt-1">Import subjects from Excel or CSV file</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-1.5 rounded hover:bg-blue-200">
                <X className="h-5 w-5 text-blue-800" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">File Format Requirements</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>&bull; <strong>Formats:</strong> Excel (.xlsx, .xls) or CSV (.csv)</li>
                  <li>&bull; <strong>Required columns:</strong> Code, Title, Units, Lec, Lab, Year Level, Semester</li>
                  <li>&bull; <strong>Optional columns:</strong> Type, Required (yes/no)</li>
                  <li>&bull; <strong>Example:</strong> CS101, Introduction to CS, 3, 3, 0, 1, 1st, lecture, yes</li>
                </ul>
              </div>

              {/* Download Template */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Download Template</p>
                    <p className="text-xs text-gray-600">CSV template with proper format and examples</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-1" />Download
                </Button>
              </div>

              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${uploadFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                onClick={() => document.getElementById('uploadFileInput')?.click()}
              >
                <input
                  type="file"
                  id="uploadFileInput"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = '' }}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null) }}
                      className="p-1 rounded hover:bg-red-50"
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-10 w-10 text-gray-400" />
                    <p className="mt-2 text-sm font-medium text-gray-900">Click to select file</p>
                    <p className="mt-1 text-xs text-gray-500">Excel (.xlsx, .xls) or CSV (.csv) up to 10MB</p>
                  </>
                )}
              </div>

              {/* Options */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreateTerms}
                  onChange={e => setAutoCreateTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Automatically create terms based on year level and semester</span>
              </label>

              {/* Upload Result */}
              {uploadResult && (
                <div className={`rounded-lg p-4 ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {uploadResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {uploadResult.message}
                      </p>
                      {uploadResult.success && (
                        <p className="text-sm text-green-700 mt-1">
                          {uploadResult.subjects_added ?? 0} subjects added, {uploadResult.terms_created ?? 0} terms created
                        </p>
                      )}
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

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
