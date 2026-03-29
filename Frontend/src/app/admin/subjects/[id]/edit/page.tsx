'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { subjectsApi, departmentsApi } from '@/lib/admin-api'
import { SUBJECT_TYPES, SEMESTERS } from '@/lib/constants'
import type { SubjectInput, Department } from '@/types'

export default function EditSubjectPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<SubjectInput>({ code: '', title: '', units: 3, departmentId: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [subj, depts] = await Promise.all([subjectsApi.get(Number(id)), departmentsApi.list({ limit: 200 })])
        setDepartments(depts.data)
        setForm({ code: subj.code, title: subj.title, description: subj.description || '', units: subj.units, lectureHours: subj.lectureHours, labHours: subj.labHours, type: subj.type, yearLevel: subj.yearLevel ?? undefined, semester: subj.semester ?? undefined, departmentId: subj.department?.id || 0 })
      } catch { setServerError('Failed to load subject.') } finally { setLoading(false) }
    }
    load()
  }, [id])

  function update(field: keyof SubjectInput, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.departmentId) e.departmentId = 'Department is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setServerError(null)
    try { await subjectsApi.update(Number(id), form); router.push(`/admin/subjects/${id}`) } catch (err: unknown) { setServerError(err instanceof Error ? err.message : 'Failed to update subject') } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/subjects/${id}`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Subject</h1><p className="mt-1 text-sm text-gray-500">Update subject information.</p></div>
      </div>

      {serverError && <Alert variant="error" onDismiss={() => setServerError(null)}>{serverError}</Alert>}

      <Card className="max-w-2xl">
        <CardHeader title="Subject Details" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Code" value={form.code} onChange={(e) => update('code', e.target.value)} error={errors.code} required />
            <Input label="Title" value={form.title} onChange={(e) => update('title', e.target.value)} error={errors.title} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Units" type="number" min={1} max={12} value={form.units} onChange={(e) => update('units', Number(e.target.value))} required />
            <Input label="Lecture Hours" type="number" min={0} value={form.lectureHours ?? 0} onChange={(e) => update('lectureHours', Number(e.target.value))} />
            <Input label="Lab Hours" type="number" min={0} value={form.labHours ?? 0} onChange={(e) => update('labHours', Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Type" value={form.type || ''} onChange={(e) => update('type', e.target.value)} options={SUBJECT_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} placeholder="Select type" />
            <Select label="Year Level" value={form.yearLevel ?? ''} onChange={(e) => update('yearLevel', Number(e.target.value))} options={[1,2,3,4].map(y => ({ value: y, label: `Year ${y}` }))} placeholder="Any" />
            <Select label="Semester" value={form.semester ?? ''} onChange={(e) => update('semester', e.target.value)} options={SEMESTERS.map(s => ({ value: s, label: s }))} placeholder="Any" />
          </div>
          <Select label="Department" value={form.departmentId || ''} onChange={(e) => update('departmentId', Number(e.target.value))} options={departments.map(d => ({ value: d.id, label: d.name }))} placeholder="Select department" error={errors.departmentId} />
          <Textarea label="Description" value={form.description || ''} onChange={(e) => update('description', e.target.value)} rows={3} />
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link href={`/admin/subjects/${id}`}><Button variant="secondary" type="button">Cancel</Button></Link>
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
