'use client'

import { useState, useEffect, useCallback, useRef, use, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertTriangle, XCircle, CheckCircle, Loader2, Settings2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { schedulesApi, subjectsApi, roomsApi } from '@/lib/admin-api'
import { DAY_PATTERNS, TIME_SLOTS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'
import type { ScheduleInput, ConflictCheckResult } from '@/types'

type DayToken = 'M' | 'T' | 'W' | 'TH' | 'F' | 'SAT' | 'SUN'

const DAY_ORDER: DayToken[] = ['M', 'T', 'W', 'TH', 'F', 'SAT', 'SUN']

const CUSTOM_DAY_OPTIONS: { value: DayToken; label: string }[] = [
  { value: 'M', label: 'Mon' },
  { value: 'T', label: 'Tue' },
  { value: 'W', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'F', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
]

function normalizeDayTokens(tokens: string[]): DayToken[] {
  const unique = Array.from(new Set(tokens.map(t => t.toUpperCase())))
  return DAY_ORDER.filter(day => unique.includes(day))
}

function parseDayPatternToTokens(pattern: string): DayToken[] {
  const cleaned = pattern.toUpperCase().trim()
  if (!cleaned) return []

  const tokenMap: Record<string, DayToken> = {
    M: 'M',
    MON: 'M',
    MONDAY: 'M',
    T: 'T',
    TUE: 'T',
    TUES: 'T',
    TUESDAY: 'T',
    W: 'W',
    WED: 'W',
    WEDNESDAY: 'W',
    TH: 'TH',
    THU: 'TH',
    THUR: 'TH',
    THURS: 'TH',
    THURSDAY: 'TH',
    F: 'F',
    FRI: 'F',
    FRIDAY: 'F',
    SAT: 'SAT',
    SATURDAY: 'SAT',
    SUN: 'SUN',
    SUNDAY: 'SUN',
  }

  const split = cleaned.split(/[-,\s/]+/).filter(Boolean)
  const mapped = split.map(part => tokenMap[part]).filter(Boolean)
  return normalizeDayTokens(mapped)
}

function resolveScheduleInput(
  form: ScheduleInput,
  useCustomFormat: boolean,
  customDays: DayToken[],
  customStartTime: string,
  customEndTime: string,
): { dayPattern: string; startTime: string; endTime: string } {
  if (!useCustomFormat) {
    return {
      dayPattern: form.dayPattern,
      startTime: form.startTime,
      endTime: form.endTime,
    }
  }

  const normalizedDays = normalizeDayTokens(customDays)
  return {
    dayPattern: normalizedDays.join('-'),
    startTime: customStartTime,
    endTime: customEndTime,
  }
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (ampmMatch) {
    let hours = Number(ampmMatch[1])
    const minutes = Number(ampmMatch[2])
    const suffix = ampmMatch[3].toUpperCase()

    if (hours < 1 || hours > 12 || minutes > 59) return null
    if (hours === 12) hours = 0
    if (suffix === 'PM') hours += 12

    return hours * 60 + minutes
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function getTimeRangeError(start: string, end: string): string | null {
  const startMinutes = parseTimeToMinutes(start)
  const endMinutes = parseTimeToMinutes(end)

  if (startMinutes === null || endMinutes === null) return null
  if (startMinutes >= endMinutes) return 'Start time must be earlier than end time.'

  return null
}

export default function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<ScheduleInput>({ semester: '1st', dayPattern: 'M-W-F', startTime: '07:00', endTime: '08:00', academicYearId: 0, subjectId: 0, roomId: 0 })
  const [timeSlot, setTimeSlot] = useState('')
  const [useCustomFormat, setUseCustomFormat] = useState(false)
  const [customDays, setCustomDays] = useState<DayToken[]>([])
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [conflicts, setConflicts] = useState<ConflictCheckResult | null>(null)
  const [checkingConflict, setCheckingConflict] = useState(false)
  const conflictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastConflictKey = useRef('')
  const [subjects, setSubjects] = useState<{ id: number; code: string; title: string }[]>([])
  const [rooms, setRooms] = useState<{ id: number; code: string }[]>([])
  const [academicYearLabel, setAcademicYearLabel] = useState('')

  useEffect(() => {
    Promise.all([
      schedulesApi.get(Number(id)),
      subjectsApi.list({ limit: 500 }),
      roomsApi.list({ limit: 500 }),
    ]).then(([sched, s, r]) => {
      const initialForm: ScheduleInput = {
        semester: sched.semester, dayPattern: sched.dayPattern || 'M-W-F',
        startTime: sched.startTime, endTime: sched.endTime, section: sched.section || '',
        enrolledStudents: sched.enrolledStudents, notes: sched.notes || '',
        academicYearId: sched.academicYear.id, subjectId: sched.subject.id,
        roomId: sched.room.id,
        facultyId: sched.faculty?.id,
      }
      setForm(initialForm)
      // Match loaded start/end time to a time slot
      const slotIdx = TIME_SLOTS.findIndex(s => s.start === initialForm.startTime && s.end === initialForm.endTime)
      const dayPatternIsPreset = DAY_PATTERNS.some(d => d.value === initialForm.dayPattern)
      const useCustom = !dayPatternIsPreset || slotIdx < 0
      if (slotIdx >= 0) setTimeSlot(String(slotIdx))
      setUseCustomFormat(useCustom)
      setCustomDays(parseDayPatternToTokens(initialForm.dayPattern))
      setCustomStartTime(initialForm.startTime)
      setCustomEndTime(initialForm.endTime)
      setAcademicYearLabel(sched.academicYear.year + (sched.academicYear.isCurrent ? ' (Current)' : ''))
      setSubjects(s.data)
      setRooms(r.data)
      // Run initial conflict check for the loaded schedule
      debouncedConflictCheck(initialForm)
    }).catch(() => setServerError('Failed to load.')).finally(() => setLoading(false))
  }, [id])

  const set = (field: keyof ScheduleInput, value: unknown) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    setErrors(prev => {
      const next = { ...prev }
      delete next[field as string]
      return next
    })
  }

  function handleTimeSlotChange(slotIndex: string) {
    setTimeSlot(slotIndex)
    if (slotIndex !== '') {
      const slot = TIME_SLOTS[Number(slotIndex)]
      if (slot) {
        const updated = { ...form, startTime: slot.start, endTime: slot.end }
        setForm(updated)
      }
    }
  }

  function toggleCustomFormat() {
    setUseCustomFormat(prev => {
      const next = !prev
      if (next) {
        setCustomDays(current => (current.length > 0 ? current : parseDayPatternToTokens(form.dayPattern)))
        setCustomStartTime(current => current || form.startTime)
        setCustomEndTime(current => current || form.endTime)
      }
      return next
    })
  }

  function toggleCustomDay(day: DayToken) {
    setCustomDays(prev => {
      const exists = prev.includes(day)
      const next = exists ? prev.filter(d => d !== day) : [...prev, day]
      return normalizeDayTokens(next)
    })
  }

  function updateCustomTime(field: 'customStartTime' | 'customEndTime', value: string) {
    if (field === 'customStartTime') {
      setCustomStartTime(value)
      return
    }

    setCustomEndTime(value)
  }

  // Debounced real-time conflict check
  const debouncedConflictCheck = useCallback((currentForm: ScheduleInput) => {
    if (conflictTimer.current) clearTimeout(conflictTimer.current)

    const timeRangeError = getTimeRangeError(currentForm.startTime, currentForm.endTime)

    if (
      !currentForm.roomId ||
      !currentForm.dayPattern ||
      !currentForm.startTime ||
      !currentForm.endTime ||
      !currentForm.academicYearId ||
      !currentForm.semester ||
      timeRangeError
    ) {
      setConflicts(null)
      setCheckingConflict(false)
      return
    }

    setCheckingConflict(true)
    conflictTimer.current = setTimeout(async () => {
      try {
        const result = await schedulesApi.checkConflict({
          ...currentForm,
          excludeId: Number(id),
        })
        setConflicts(result)
      } catch {
        setConflicts(null)
      } finally {
        setCheckingConflict(false)
      }
    }, 800)
  }, [id])

  useEffect(() => {
    const resolved = resolveScheduleInput(form, useCustomFormat, customDays, customStartTime, customEndTime)
    const key = [
      form.roomId,
      resolved.dayPattern,
      resolved.startTime,
      resolved.endTime,
      form.academicYearId,
      form.semester,
      form.subjectId,
      form.section,
      form.facultyId,
    ].join('|')

    if (lastConflictKey.current === key) {
      return
    }

    lastConflictKey.current = key
    debouncedConflictCheck({
      ...form,
      dayPattern: resolved.dayPattern,
      startTime: resolved.startTime,
      endTime: resolved.endTime,
    })
  }, [form, useCustomFormat, customDays, customStartTime, customEndTime, debouncedConflictCheck])

  function validate(): boolean {
    const nextErrors: Record<string, string> = {}
    const resolved = resolveScheduleInput(form, useCustomFormat, customDays, customStartTime, customEndTime)
    const timeRangeError = getTimeRangeError(resolved.startTime, resolved.endTime)
    if (!form.academicYearId) nextErrors.academicYearId = 'Required.'
    if (!form.subjectId) nextErrors.subjectId = 'Required.'
    if (!form.roomId) nextErrors.roomId = 'Required.'
    if (!resolved.startTime) nextErrors.startTime = 'Required.'
    if (!resolved.endTime) nextErrors.endTime = 'Required.'
    if (!resolved.dayPattern) nextErrors.dayPattern = 'Required.'
    if (timeRangeError) nextErrors.startTime = timeRangeError
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError('')
    try {
      const resolved = resolveScheduleInput(form, useCustomFormat, customDays, customStartTime, customEndTime)
      const response = await schedulesApi.update(Number(id), {
        ...form,
        dayPattern: resolved.dayPattern,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
      })
      if (response.meta?.conflicts?.length) {
        setConflicts({
          hasConflict: true,
          conflicts: response.meta.conflicts.map(msg => ({ type: 'warning', message: msg })),
        })
      }
      router.push(`/admin/schedules/${id}`)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to update.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  const dayOptions = DAY_PATTERNS.map(d => ({ value: d.value, label: d.label }))
  const timeSlotOptions = TIME_SLOTS.map((s, i) => ({ value: String(i), label: s.label }))
  const resolvedSchedule = resolveScheduleInput(form, useCustomFormat, customDays, customStartTime, customEndTime)
  const timeRangeError = getTimeRangeError(resolvedSchedule.startTime, resolvedSchedule.endTime)
  const subjectOptions = [{ value: '', label: '-- Select Subject --' }, ...subjects.map(s => ({ value: String(s.id), label: `${s.code} - ${s.title}` }))]
  const roomOptions = [{ value: '', label: '-- Select Room --' }, ...rooms.map(r => ({ value: String(r.id), label: r.code }))]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/schedules" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" /></Link>
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Schedule</h1></div>
      </div>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
                  <div className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">
                    {academicYearLabel || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                  <div className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">
                    {form.semester || '—'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Subject" required value={form.subjectId ? String(form.subjectId) : ''} onChange={e => set('subjectId', Number(e.target.value))} options={subjectOptions} error={errors.subjectId} />
                <Select label="Room" required value={form.roomId ? String(form.roomId) : ''} onChange={e => set('roomId', Number(e.target.value))} options={roomOptions} error={errors.roomId} />
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={toggleCustomFormat}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${useCustomFormat
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                    }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {useCustomFormat ? 'Use Preset' : 'Custom Format'}
                </button>
              </div>

              {!useCustomFormat && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Day Pattern" required value={form.dayPattern || ''} onChange={e => set('dayPattern', e.target.value)} options={dayOptions} error={errors.dayPattern} />
                  <Select label="Time Slot" required value={timeSlot} onChange={e => handleTimeSlotChange(e.target.value)} placeholder="Select time..." options={timeSlotOptions} error={errors.startTime} />
                </div>
              )}

              {useCustomFormat && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Day Pattern <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {CUSTOM_DAY_OPTIONS.map(day => {
                        const active = customDays.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleCustomDay(day.value)}
                            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${active
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                              }`}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Selected: {resolvedSchedule.dayPattern || 'None'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Start Time" required type="time" value={customStartTime} onChange={e => updateCustomTime('customStartTime', e.target.value)} />
                    <Input label="End Time" required type="time" value={customEndTime} onChange={e => updateCustomTime('customEndTime', e.target.value)} />
                  </div>
                  {timeRangeError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{timeRangeError}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
                  <div className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">
                    {form.section || '—'}
                  </div>
                </div>
                <Input label="Enrolled Students" type="number" value={String(form.enrolledStudents ?? '')} onChange={e => set('enrolledStudents', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <Textarea label="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
              <div className="flex justify-end gap-3 pt-4">
                <Link href="/admin/schedules"><Button variant="secondary">Cancel</Button></Link>
                <Button type="submit" disabled={saving || (conflicts?.hasConflict ?? false)}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : conflicts?.hasConflict ? 'Resolve Conflicts First' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right: Conflict Status Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Conflict check status */}
          {checkingConflict && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking for conflicts...
            </div>
          )}

          {!checkingConflict && conflicts && !conflicts.hasConflict && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold text-sm mb-1">
                <CheckCircle className="h-4 w-4" /> No Conflicts
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">This schedule does not conflict with any other active schedules.</p>
            </div>
          )}

          {!checkingConflict && conflicts?.hasConflict && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300 text-sm mb-3">
                <XCircle className="h-4 w-4" />
                {conflicts.conflicts.length} Conflict{conflicts.conflicts.length > 1 ? 's' : ''} Detected
              </div>
              <div className="space-y-2">
                {conflicts.conflicts.map((c, i) => {
                  const s = c.schedule
                  return (
                    <div key={i} className="text-xs bg-white dark:bg-gray-800 border border-red-100 dark:border-red-800 rounded p-2.5 space-y-1">
                      {s ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{s.subject.code}</span>
                            <span className="text-gray-500 dark:text-gray-400">Section {s.section || '—'}</span>
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 text-[11px]">{s.subject.title}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            {c.type === 'room_time_conflict' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">🏫 Room</span>
                            )}
                            {c.type === 'faculty_conflict' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">👤 Faculty</span>
                            )}
                            {c.type === 'section_conflict' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">📋 Section</span>
                            )}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300 mt-1">
                            {c.type === 'room_time_conflict' && (<>Room <strong>{s.room.code}</strong> is booked on <strong>{s.dayPattern}</strong> at <strong>{formatTime(s.startTime)}–{formatTime(s.endTime)}</strong></>)}
                            {c.type === 'faculty_conflict' && (<><strong>{s.faculty?.fullName || 'Faculty'}</strong> is teaching on <strong>{s.dayPattern}</strong> at <strong>{formatTime(s.startTime)}–{formatTime(s.endTime)}</strong></>)}
                            {c.type === 'section_conflict' && (<>Section <strong>{s.section}</strong> has a class on <strong>{s.dayPattern}</strong> at <strong>{formatTime(s.startTime)}–{formatTime(s.endTime)}</strong> in <strong>{s.room.code}</strong></>)}
                          </div>
                        </>
                      ) : (
                        <div className="text-red-600">{c.message}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Info panel */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Real-Time Conflict Detection</h3>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  Conflicts are checked automatically when you change room, day pattern, or time slot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
