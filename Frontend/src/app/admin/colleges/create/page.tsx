'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { collegesApi } from '@/lib/admin-api'
import type { CollegeInput } from '@/types'

export default function CreateCollegePage() {
  const router = useRouter()
  const [form, setForm] = useState<CollegeInput>({ code: '', name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function update(field: keyof CollegeInput, value: string) {
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
      await collegesApi.create(form)
      router.push('/admin/colleges')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create college'
      setServerError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/colleges" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create College</h1>
          <p className="mt-1 text-sm text-gray-500">Add a new college to the system.</p>
        </div>
      </div>

      {serverError && <Alert variant="error" onDismiss={() => setServerError(null)}>{serverError}</Alert>}

      <Card className="max-w-2xl">
        <CardHeader title="College Details" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Code" value={form.code} onChange={(e) => update('code', e.target.value)} error={errors.code} placeholder="e.g. COE" required />
            <Input label="Name" value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} placeholder="College name" required />
          </div>
          <Input label="Dean" value={form.dean || ''} onChange={(e) => update('dean', e.target.value)} placeholder="Dean name (optional)" />
          <Textarea label="Description" value={form.description || ''} onChange={(e) => update('description', e.target.value)} placeholder="Description (optional)" rows={3} />

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link href="/admin/colleges"><Button variant="secondary" type="button">Cancel</Button></Link>
            <Button type="submit" loading={saving}>Create College</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
