'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { roomsApi, departmentsApi, departmentGroupsApi } from '@/lib/admin-api'
import { ROOM_TYPES } from '@/lib/constants'
import type { RoomInput, Department, DepartmentGroup } from '@/types'

export default function EditRoomPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<RoomInput>({ code: '', departmentId: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [groups, setGroups] = useState<DepartmentGroup[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [room, d, g] = await Promise.all([roomsApi.get(Number(id)), departmentsApi.list({ limit: 200 }), departmentGroupsApi.list({ limit: 100 })])
        setDepartments(d.data); setGroups(g.data)
        setForm({ code: room.code, name: room.name || '', type: room.type || '', capacity: room.capacity ?? undefined, building: room.building || '', floor: room.floor || '', departmentId: room.department?.id || 0, departmentGroupId: room.departmentGroup?.id })
      } catch { setServerError('Failed to load room.') } finally { setLoading(false) }
    }
    load()
  }, [id])

  function update(field: keyof RoomInput, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.departmentId) e.departmentId = 'Department is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setServerError(null)
    try { await roomsApi.update(Number(id), form); router.push(`/admin/rooms/${id}`) } catch (err: unknown) { setServerError(err instanceof Error ? err.message : 'Failed to update room') } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/rooms/${id}`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Room</h1><p className="mt-1 text-sm text-gray-500">Update room information.</p></div>
      </div>

      {serverError && <Alert variant="error" onDismiss={() => setServerError(null)}>{serverError}</Alert>}

      <Card className="max-w-2xl">
        <CardHeader title="Room Details" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Code" value={form.code} onChange={(e) => update('code', e.target.value)} error={errors.code} required />
            <Input label="Name" value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Type" value={form.type || ''} onChange={(e) => update('type', e.target.value)} options={ROOM_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} placeholder="Select type" />
            <Input label="Capacity" type="number" min={1} value={form.capacity ?? ''} onChange={(e) => update('capacity', Number(e.target.value))} />
            <Input label="Floor" value={form.floor || ''} onChange={(e) => update('floor', e.target.value)} />
          </div>
          <Input label="Building" value={form.building || ''} onChange={(e) => update('building', e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Department" value={form.departmentId || ''} onChange={(e) => update('departmentId', Number(e.target.value))} options={departments.map(d => ({ value: d.id, label: d.name }))} placeholder="Select department" error={errors.departmentId} />
            <Select label="Department Group" value={form.departmentGroupId ?? ''} onChange={(e) => update('departmentGroupId', Number(e.target.value) || 0)} options={groups.map(g => ({ value: g.id, label: g.name }))} placeholder="Select group (optional)" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link href={`/admin/rooms/${id}`}><Button variant="secondary" type="button">Cancel</Button></Link>
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
