'use client'

import { useState, useEffect, use, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { curriculaApi, departmentsApi, academicYearsApi } from '@/lib/admin-api'
import type { CurriculumInput } from '@/types'

export default function EditCurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<CurriculumInput>({ name: '', departmentId: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [years, setYears] = useState<{ id: number; year: string }[]>([])

  useEffect(() => {
    Promise.all([
      curriculaApi.get(Number(id)),
      departmentsApi.list({ limit: 200 }),
      academicYearsApi.list({ limit: 200 }),
    ]).then(([c, d, y]) => {
      setForm({
        name: c.name, departmentId: c.department?.id || 0, version: c.version,
        isPublished: c.isPublished, effectiveYearId: c.effectiveYearId || undefined,
        notes: c.notes || '',
      })
      setDepartments(d.data)
      setYears(y.data)
    }).catch(() => setServerError('Failed to load.')).finally(() => setLoading(false))
  }, [id])

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.departmentId) e.departmentId = 'Department is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError('')
    try {
      await curriculaApi.update(Number(id), form)
      router.push(`/admin/curricula/${id}`)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to update.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  const deptOptions = [{ value: '', label: '-- Select Department --' }, ...departments.map(d => ({ value: String(d.id), label: d.name }))]
  const yearOptions = [{ value: '', label: '-- None --' }, ...years.map(y => ({ value: String(y.id), label: y.year }))]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/curricula/${id}`} className="p-2 rounded hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div><h1 className="text-3xl font-bold text-gray-900">Edit Curriculum</h1></div>
      </div>
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <Input label="Curriculum Name" required value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Department" required value={form.departmentId ? String(form.departmentId) : ''} onChange={(e) => set('departmentId', Number(e.target.value))} options={deptOptions} error={errors.departmentId} />
            <Select label="Effective Academic Year" value={form.effectiveYearId ? String(form.effectiveYearId) : ''} onChange={(e) => set('effectiveYearId', e.target.value ? Number(e.target.value) : undefined)} options={yearOptions} />
          </div>
          <Input label="Version" type="number" value={String(form.version ?? 1)} onChange={e => set('version', Number(e.target.value))} />
          <Textarea label="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} />
          <div className="flex justify-end gap-3 pt-4">
            <Link href={`/admin/curricula/${id}`}><Button variant="secondary">Cancel</Button></Link>
            <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
