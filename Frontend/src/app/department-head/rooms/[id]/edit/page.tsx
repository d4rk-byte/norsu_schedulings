'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { dhRoomsApi } from '@/lib/department-head-api'
import { ROOM_TYPES } from '@/lib/constants'
import type { Room } from '@/types'

interface FormState {
  code: string
  name: string
  building: string
  floor: string
  type: string
  capacity: number | ''
}

export default function DHRoomEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>({ code: '', name: '', building: '', floor: '', type: 'lecture', capacity: '' })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dhRoomsApi.get(Number(id))
      .then((room: Room) => {
        setForm({
          code: room.code || '',
          name: room.name || '',
          building: room.building || '',
          floor: room.floor != null ? String(room.floor) : '',
          type: room.type || 'lecture',
          capacity: room.capacity ?? '',

        })
      })
      .catch(() => setError('Failed to load room'))
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Required'
    if (!form.name.trim()) e.name = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      await dhRoomsApi.update(Number(id), {
        code: form.code.trim(),
        name: form.name.trim(),
        building: form.building.trim() || undefined,
        floor: form.floor.trim() || undefined,
        type: form.type,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      })
      router.push(`/department-head/rooms/${id}`)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update room.')
    } finally {
      setSaving(false)
    }
  }

  const typeOptions = ROOM_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/department-head/rooms/${id}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Room</h1>
          <p className="mt-1 text-sm text-gray-500">Update room details</p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Room Code" required value={form.code} onChange={e => set('code', e.target.value)} error={errors.code} />
            <Input label="Room Name" required value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Building" value={form.building} onChange={e => set('building', e.target.value)} />
            <Input label="Floor" value={form.floor} onChange={e => set('floor', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Room Type" value={form.type} onChange={e => set('type', e.target.value)} options={typeOptions} />
            <Input label="Capacity" type="number" value={form.capacity !== '' ? String(form.capacity) : ''} onChange={e => set('capacity', e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Link href={`/department-head/rooms/${id}`}><Button type="button" variant="secondary">Cancel</Button></Link>
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
