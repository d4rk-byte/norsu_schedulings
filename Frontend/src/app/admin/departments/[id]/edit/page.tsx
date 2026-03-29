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
import { departmentsApi, collegesApi, departmentGroupsApi } from '@/lib/admin-api'
import type { DepartmentInput, College, DepartmentGroup } from '@/types'

export default function EditDepartmentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<DepartmentInput>({ code: '', name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [colleges, setColleges] = useState<College[]>([])
  const [groups, setGroups] = useState<DepartmentGroup[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [dept, c, g] = await Promise.all([
          departmentsApi.get(Number(id)),
          collegesApi.list({ limit: 100 }),
          departmentGroupsApi.list({ limit: 100 }),
        ])
        setColleges(c.data)
        setGroups(g.data)
        setForm({
          code: dept.code,
          name: dept.name,
          description: dept.description || '',
          contactEmail: dept.contactEmail || '',
          collegeId: dept.college?.id,
          departmentGroupId: dept.departmentGroup?.id,
        })
      } catch { setServerError('Failed to load department.') } finally { setLoading(false) }
    }
    load()
  }, [id])

  function update(field: keyof DepartmentInput, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError(null)
    try {
      await departmentsApi.update(Number(id), form)
      router.push(`/admin/departments/${id}`)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/departments/${id}`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Department</h1>
          <p className="mt-1 text-sm text-gray-500">Update department information.</p>
        </div>
      </div>

      {serverError && <Alert variant="error" onDismiss={() => setServerError(null)}>{serverError}</Alert>}

      <Card className="max-w-2xl">
        <CardHeader title="Department Details" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Code" value={form.code} onChange={(e) => update('code', e.target.value)} error={errors.code} required />
            <Input label="Name" value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="College" value={form.collegeId ?? ''} onChange={(e) => update('collegeId', Number(e.target.value) || 0)} options={colleges.map(c => ({ value: c.id, label: c.name }))} placeholder="Select college" />
            <Select label="Department Group" value={form.departmentGroupId ?? ''} onChange={(e) => update('departmentGroupId', Number(e.target.value) || 0)} options={groups.map(g => ({ value: g.id, label: g.name }))} placeholder="Select group (optional)" />
          </div>
          <Input label="Contact Email" type="email" value={form.contactEmail || ''} onChange={(e) => update('contactEmail', e.target.value)} />
          <Textarea label="Description" value={form.description || ''} onChange={(e) => update('description', e.target.value)} rows={3} />
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link href={`/admin/departments/${id}`}><Button variant="secondary" type="button">Cancel</Button></Link>
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
