'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Eye, FileSpreadsheet, Upload, X, XCircle, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { dhCurriculaApi } from '@/lib/department-head-api'
import type { Curriculum } from '@/types'

export default function DHCurriculaListPage() {
  const router = useRouter()
  const list = useCrudList<Curriculum>((p) => dhCurriculaApi.list(p))
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [actionError, setActionError] = useState('')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadVersion, setUploadVersion] = useState(1)
  const [uploadAutoTerms, setUploadAutoTerms] = useState(true)
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message?: string; subjects_added?: number; terms_created?: number; errors?: string[] } | null>(null)

  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (statusFilter !== 'all') {
      params.is_published = statusFilter === 'published' ? 1 : 0
    }
    list.setExtraParams(params)
  }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleStats = useMemo(() => {
    const published = list.data.filter((c) => c.isPublished).length
    return {
      total: list.meta.total || list.data.length,
      published,
      draft: Math.max(0, list.data.length - published),
    }
  }, [list.data, list.meta.total])

  async function togglePublish(curriculum: Curriculum) {
    if (togglingId === curriculum.id) return

    setActionError('')
    setTogglingId(curriculum.id)
    try {
      if (curriculum.isPublished) {
        await dhCurriculaApi.unpublish(curriculum.id)
      } else {
        await dhCurriculaApi.publish(curriculum.id)
      }
      list.refresh()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setActionError(msg || 'Failed to update curriculum status.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDownloadTemplate() {
    try {
      const data = await dhCurriculaApi.downloadTemplate()
      const blob = new Blob([data.content], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setActionError('Failed to download template.')
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return
    setUploading(true)
    setUploadResult(null)
    setActionError('')
    try {
      const result = await dhCurriculaApi.bulkUpload(uploadFile, uploadName.trim(), uploadVersion, uploadAutoTerms)
      setUploadResult({
        success: true,
        message: 'Curriculum uploaded successfully.',
        subjects_added: result.subjects_added,
        terms_created: result.terms_created,
        errors: result.errors,
      })
      setUploadFile(null)
      setUploadName('')
      setUploadVersion(1)
      list.refresh()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Upload failed.'
      setUploadResult({ success: false, message: msg })
    } finally {
      setUploading(false)
    }
  }

  const columns: Column<Curriculum>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (c) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'version', header: 'Version', render: (c) => c.version ? `v${c.version}` : '—' },
    { key: 'terms', header: 'Terms', render: (c) => (c as Curriculum & { termCount?: number }).termCount ?? (c.curriculumTerms ?? []).length },
    { key: 'isPublished', header: 'Status', render: (c) => (
      <Badge variant={c.isPublished ? 'success' : 'warning'}>{c.isPublished ? 'Published' : 'Draft'}</Badge>
    )},
    { key: 'updatedAt', header: 'Updated', render: (c) => c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '—' },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (c) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/department-head/curricula/${c.id}`}
            className="p-1.5 rounded hover:bg-gray-100"
            title="View curriculum"
          >
            <Eye className="h-4 w-4 text-gray-600" />
          </Link>
          <button
            onClick={() => togglePublish(c)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
            title={c.isPublished ? 'Unpublish curriculum' : 'Publish curriculum'}
            disabled={togglingId === c.id}
          >
            {c.isPublished ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Curricula</h1>
        <p className="mt-1 text-sm text-gray-500">View curricula for your department</p>
      </div>

      {list.error && <Alert variant="error">{list.error}</Alert>}
      {actionError && <Alert variant="error" onDismiss={() => setActionError('')}>{actionError}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Curricula</p>
          <p className="text-2xl font-bold text-gray-900">{visibleStats.total}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Published</p>
          <p className="text-2xl font-bold text-green-600">{visibleStats.published}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Draft</p>
          <p className="text-2xl font-bold text-amber-600">{visibleStats.draft}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search curricula..." className="max-w-sm" />
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setShowUpload(true); setUploadResult(null) }}>
              <Upload className="h-4 w-4 mr-1" />Upload Curriculum
            </Button>
            <Button size="sm" variant={statusFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('all')}>All</Button>
            <Button size="sm" variant={statusFilter === 'published' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('published')}>Published</Button>
            <Button size="sm" variant={statusFilter === 'draft' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('draft')}>Draft</Button>
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(c) => c.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(c) => router.push(`/department-head/curricula/${c.id}`)} emptyTitle="No curricula found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <Modal
        open={showUpload}
        onClose={() => { if (!uploading) setShowUpload(false) }}
        title="Upload Curriculum"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUpload(false)} disabled={uploading}>Close</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || !uploadName.trim() || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum Name</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g., BS Information Technology"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                type="number"
                min={1}
                value={uploadVersion}
                onChange={(e) => setUploadVersion(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={uploadAutoTerms}
                  onChange={(e) => setUploadAutoTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Auto-create terms</span>
              </label>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3 border border-green-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Download Template</p>
                <p className="text-xs text-gray-600">Use CSV, XLSX, or XLS format</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" />Download
            </Button>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition ${uploadFile ? 'border-primary-400 bg-primary-50/30' : 'border-gray-300 hover:border-primary-400'}`}
            onClick={() => document.getElementById('dhUploadCurriculumFile')?.click()}
          >
            <input
              id="dhUploadCurriculumFile"
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setUploadFile(f)
                e.target.value = ''
              }}
            />

            {uploadFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-7 w-7 text-primary-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                  <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setUploadFile(null) }} className="p-1 rounded hover:bg-red-50">
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-900">Click to select file</p>
                <p className="mt-1 text-xs text-gray-500">CSV, XLSX, XLS up to 10MB</p>
              </>
            )}
          </div>

          {uploadResult && (
            <div className={`rounded-lg p-3 ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start gap-2">
                {uploadResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                <div>
                  <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>{uploadResult.message}</p>
                  {uploadResult.success && (
                    <p className="text-sm text-green-700 mt-1">{uploadResult.subjects_added ?? 0} subjects added, {uploadResult.terms_created ?? 0} terms created</p>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs text-red-700 space-y-0.5 max-h-28 overflow-y-auto">
                      {uploadResult.errors.map((err, idx) => <li key={idx}>• {err}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
