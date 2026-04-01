'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, CheckCircle, FileEdit, Building2, Upload, X, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { curriculaApi, departmentsApi } from '@/lib/admin-api'

type DeptStats = {
  id: number
  name: string
  code: string
  college: { id: number; name: string; code: string } | null
  curricula: { total: number; published: number; draft: number }
}

export default function CurriculaPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<{ total: number; published: number; draft: number; departments: number }>({ total: 0, published: 0, draft: 0, departments: 0 })
  const [departments, setDepartments] = useState<DeptStats[]>([])
  const [searchFilter, setSearchFilter] = useState('')

  // Bulk upload
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkName, setBulkName] = useState('')
  const [bulkVersion, setBulkVersion] = useState(1)
  const [bulkDeptId, setBulkDeptId] = useState<number | ''>('')
  const [bulkAutoTerms, setBulkAutoTerms] = useState(true)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ success: boolean; message?: string; subjects_added?: number; terms_created?: number; errors?: string[] } | null>(null)
  const [toast, setToast] = useState<{ show: boolean; success: boolean; message: string } | null>(null)

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    curriculaApi.stats()
      .then(data => {
        setStats(data.statistics)
        setDepartments(data.departments)
      })
      .catch(() => setError('Failed to load curricula statistics.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleBulkUpload() {
    if (!bulkFile || !bulkName || !bulkDeptId) return
    setBulkUploading(true)
    setBulkResult(null)
    try {
      const result = await curriculaApi.bulkUpload(bulkFile, bulkName, bulkVersion, Number(bulkDeptId), bulkAutoTerms)
      const subjectsAdded = result.subjects_added ?? 0
      const termsCreated = result.terms_created ?? 0
      setBulkResult({ success: true, message: 'Curriculum uploaded successfully!', subjects_added: subjectsAdded, terms_created: termsCreated, errors: result.errors })
      setToast({ show: true, success: true, message: `✓ Curriculum created! ${subjectsAdded} subjects added, ${termsCreated} terms created.` })
      setBulkFile(null)
      setBulkName('')
      setBulkVersion(1)
      setBulkDeptId('')
      // Refresh stats
      const data = await curriculaApi.stats()
      setStats(data.statistics)
      setDepartments(data.departments)
      // Close modal after success (with slight delay so user sees the result)
      setTimeout(() => setShowBulkUpload(false), 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Upload failed.'
      setBulkResult({ success: false, message: msg })
      setToast({ show: true, success: false, message: `✗ Upload failed: ${msg}` })
    }
    setBulkUploading(false)
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

  const filtered = searchFilter
    ? departments.filter(d =>
        d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        d.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (d.college?.name || '').toLowerCase().includes(searchFilter.toLowerCase())
      )
    : departments

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error && !departments.length) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast?.show && (
        <div className={`fixed top-4 right-4 z-100 max-w-md px-4 py-3 rounded-lg shadow-lg transition-all transform animate-in fade-in slide-in-from-top-2 ${
          toast.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toast.success ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <p className="text-sm font-medium">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-2 p-1 hover:bg-white/20 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Curricula Management</h1>
        <p className="mt-1 text-sm text-gray-500">Browse curricula by department</p>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Curricula</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-1">Across all departments</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><BookOpen className="h-7 w-7 text-indigo-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Published</p>
              <p className="text-3xl font-bold text-green-600">{stats.published}</p>
              <p className="text-xs text-green-500 mt-1">Active curricula</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><CheckCircle className="h-7 w-7 text-green-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Draft</p>
              <p className="text-3xl font-bold text-amber-600">{stats.draft}</p>
              <p className="text-xs text-amber-500 mt-1">Unpublished curricula</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg"><FileEdit className="h-7 w-7 text-amber-500" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Departments</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.departments}</p>
              {(() => { const active = departments.filter(d => d.curricula.total > 0).length; return <p className="text-xs text-gray-400 mt-1">{active} with curricula</p> })()}
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Building2 className="h-7 w-7 text-blue-500" /></div>
          </div>
        </Card>
      </div>

      {/* Department Cards */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Departments</h2>
            <p className="text-sm text-gray-500">Select a department to view and manage its curricula</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search departments..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none w-64"
            />
            <Button variant="secondary" onClick={() => { setShowBulkUpload(true); setBulkResult(null); setBulkFile(null) }}>
              <Upload className="h-4 w-4 mr-2" />Upload Curriculum
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">{searchFilter ? 'No departments match your search.' : 'No departments found.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(dept => (
              <div key={dept.id} className="border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 rounded-xl hover:border-primary-400 hover:shadow-lg transition-all group flex flex-col">
                <div className="p-5 flex flex-col flex-1">
                  {/* Dept Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-h-[70px]">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{dept.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{dept.code}</p>
                      {dept.college && <p className="text-xs text-gray-400 mt-0.5">{dept.college.name}</p>}
                    </div>
                    <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
                      <Building2 className="h-5 w-5 text-primary-600" />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-0 mb-5">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{dept.curricula.total}</p>
                      <p className="text-xs text-gray-500 mt-1">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600">{dept.curricula.published}</p>
                      <p className="text-xs text-gray-500 mt-1">Published</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-amber-600">{dept.curricula.draft}</p>
                      <p className="text-xs text-gray-500 mt-1">Draft</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <Link href={`/admin/curricula/department/${dept.id}`} className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
                      View Curricula
                    </Link>
                    <Link href={`/admin/curricula/create?department_id=${dept.id}`} className="inline-flex items-center justify-center px-3 py-2 border-2 border-primary-600 text-primary-600 text-sm font-medium rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors" title="Add Curriculum">
                      +
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !bulkUploading && setShowBulkUpload(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            {/* Loading overlay */}
            {bulkUploading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-10 flex flex-col items-center justify-center rounded-xl">
                <Spinner className="h-10 w-10 text-primary-600" />
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Uploading curriculum...</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This may take a moment</p>
              </div>
            )}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-blue-900">Upload Curriculum</h3>
                <p className="text-sm text-blue-700 mt-1">Create a new curriculum by uploading subjects from a file</p>
              </div>
              <button onClick={() => setShowBulkUpload(false)} className="p-1.5 rounded hover:bg-blue-200" disabled={bulkUploading}><X className="h-5 w-5 text-blue-800" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
                <select value={bulkDeptId} onChange={e => setBulkDeptId(e.target.value ? Number(e.target.value) : '')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none">
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>
              {/* Curriculum Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Curriculum Name <span className="text-red-500">*</span></label>
                <input value={bulkName} onChange={e => setBulkName(e.target.value)} placeholder="e.g., Bachelor of Science in Computer Science" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" />
              </div>
              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version <span className="text-red-500">*</span></label>
                <input type="number" min={1} value={bulkVersion} onChange={e => setBulkVersion(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" />
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
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Download Template</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">CSV template with examples</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleDownloadTemplate}><Download className="h-4 w-4 mr-1" />Download</Button>
              </div>
              {/* File */}
              <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${bulkFile ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}
                onClick={() => document.getElementById('bulkFileInput')?.click()}
              >
                <input type="file" id="bulkFileInput" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkFile(f); e.target.value = '' }} />
                {bulkFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{bulkFile.name}</p>
                      <p className="text-xs text-gray-500">{(bulkFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setBulkFile(null) }} className="p-1 rounded hover:bg-red-50"><X className="h-4 w-4 text-red-500" /></button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-9 w-9 text-gray-400" />
                    <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">Click to select file</p>
                    <p className="mt-1 text-xs text-gray-500">Excel (.xlsx, .xls) or CSV (.csv) up to 10MB</p>
                  </>
                )}
              </div>
              {/* Options */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={bulkAutoTerms} onChange={e => setBulkAutoTerms(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Auto-create terms from year level and semester</span>
              </label>
              {/* Result */}
              {bulkResult && (
                <div className={`rounded-lg p-4 ${bulkResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {bulkResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-sm font-medium ${bulkResult.success ? 'text-green-800' : 'text-red-800'}`}>{bulkResult.message}</p>
                      {bulkResult.success && <p className="text-sm text-green-700 mt-1">{bulkResult.subjects_added ?? 0} subjects added, {bulkResult.terms_created ?? 0} terms created</p>}
                      {bulkResult.errors && bulkResult.errors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
                          {bulkResult.errors.map((err, i) => <li key={i}>&bull; {err}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
              <Button variant="secondary" onClick={() => setShowBulkUpload(false)} disabled={bulkUploading}>Cancel</Button>
              <Button onClick={handleBulkUpload} disabled={!bulkFile || !bulkName || !bulkDeptId || bulkUploading}>
                {bulkUploading ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Uploading...
                  </span>
                ) : 'Upload Curriculum'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
