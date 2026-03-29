'use client'

import { useState, useEffect, use, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { academicYearsApi } from '@/lib/admin-api'
import { SEMESTERS } from '@/lib/constants'
import type { AcademicYearInput } from '@/types'

export default function EditAcademicYearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<AcademicYearInput>({ year: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    academicYearsApi.get(Number(id)).then(ay => {
      setForm({
        year: ay.year, currentSemester: ay.currentSemester || undefined,
        isCurrent: ay.isCurrent,
        startDate: ay.startDate?.split('T')[0] || undefined, endDate: ay.endDate?.split('T')[0] || undefined,
        firstSemStart: ay.firstSemStart?.split('T')[0] || undefined, firstSemEnd: ay.firstSemEnd?.split('T')[0] || undefined,
        secondSemStart: ay.secondSemStart?.split('T')[0] || undefined, secondSemEnd: ay.secondSemEnd?.split('T')[0] || undefined,
        summerStart: ay.summerStart?.split('T')[0] || undefined, summerEnd: ay.summerEnd?.split('T')[0] || undefined,
      })
    }).catch(() => setServerError('Failed to load academic year.')).finally(() => setLoading(false))
  }, [id])

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value || undefined }))

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.year.trim()) e.year = 'Year is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError('')
    try {
      await academicYearsApi.update(Number(id), form)
      router.push('/admin/academic-years')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to update.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  const semOptions = [{ value: '', label: '-- Select --' }, ...SEMESTERS.map(s => ({ value: s, label: s }))]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/academic-years" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Academic Year</h1></div>
      </div>
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Year" required placeholder="2024-2025" value={form.year} onChange={e => setForm(prev => ({ ...prev, year: e.target.value }))} error={errors.year} />
            <Select label="Current Semester" value={form.currentSemester || ''} onChange={(e) => set('currentSemester', e.target.value)} options={semOptions} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Overall Start Date" value={form.startDate || ''} onChange={v => set('startDate', v)} />
            <DatePicker label="Overall End Date" value={form.endDate || ''} onChange={v => set('endDate', v)} minDate={form.startDate} />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.isCurrent ?? false} onChange={e => setForm(prev => ({ ...prev, isCurrent: e.target.checked }))} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ms-2 text-sm font-medium text-gray-700 dark:text-gray-300">Set as Current Year</span>
            </label>
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">1st Semester Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Start" value={form.firstSemStart || ''} onChange={v => set('firstSemStart', v)} />
            <DatePicker label="End" value={form.firstSemEnd || ''} onChange={v => set('firstSemEnd', v)} minDate={form.firstSemStart} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">2nd Semester Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Start" value={form.secondSemStart || ''} onChange={v => set('secondSemStart', v)} />
            <DatePicker label="End" value={form.secondSemEnd || ''} onChange={v => set('secondSemEnd', v)} minDate={form.secondSemStart} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">Summer Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Start" value={form.summerStart || ''} onChange={v => set('summerStart', v)} />
            <DatePicker label="End" value={form.summerEnd || ''} onChange={v => set('summerEnd', v)} minDate={form.summerStart} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Link href="/admin/academic-years"><Button variant="secondary">Cancel</Button></Link>
            <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
