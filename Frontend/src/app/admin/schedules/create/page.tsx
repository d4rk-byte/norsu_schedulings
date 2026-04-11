'use client'

import { Suspense, useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, AlertTriangle, Info, XCircle, CheckCircle, Loader2, Settings2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { Alert } from '@/components/ui/Alert'
import { schedulesApi, subjectsApi, roomsApi, academicYearsApi, departmentsApi } from '@/lib/admin-api'
import { DAY_PATTERNS, TIME_SLOTS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'
import type { Subject, Room, Department, AcademicYear, ConflictCheckResult } from '@/types'

interface SectionData {
  section: string
  roomId: string
  dayPattern: string
  timeSlot: string
  startTime: string
  endTime: string
  useCustomFormat: boolean
  customDays: string[]
  customStartTime: string
  customEndTime: string
  enrolledStudents: string
}

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

const MAX_SECTIONS = 10

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

function getMaxSectionIndex(labels: string[]): number {
  let maxIndex = -1
  labels.forEach((label) => {
    const normalized = label.trim().toUpperCase()
    if (normalized.length === 1 && normalized >= 'A' && normalized <= 'Z') {
      const idx = normalized.charCodeAt(0) - 65
      if (idx > maxIndex) maxIndex = idx
    }
  })
  return maxIndex
}

function resolveSectionSchedule(sec: SectionData): { dayPattern: string; startTime: string; endTime: string } {
  if (!sec.useCustomFormat) {
    return {
      dayPattern: sec.dayPattern,
      startTime: sec.startTime,
      endTime: sec.endTime,
    }
  }

  const normalizedDays = normalizeDayTokens(sec.customDays)
  return {
    dayPattern: normalizedDays.join('-'),
    startTime: sec.customStartTime,
    endTime: sec.customEndTime,
  }
}

const defaultSection = (letter: string): SectionData => ({
  section: letter,
  roomId: '',
  dayPattern: '',
  timeSlot: '',
  startTime: '',
  endTime: '',
  useCustomFormat: false,
  customDays: [],
  customStartTime: '',
  customEndTime: '',
  enrolledStudents: '',
})

function CreateSchedulePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const departmentId = searchParams.get('department')

  // Data state
  const [department, setDepartment] = useState<Department | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeAy, setActiveAy] = useState<AcademicYear | null>(null)

  // Step 1: Common fields
  const [subjectId, setSubjectId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [semester, setSemester] = useState('')
  const [sectionCount, setSectionCount] = useState('')

  // Step 2: Dynamic sections
  const [sections, setSections] = useState<SectionData[]>([])

  // Existing sections (to compute next available letter)
  const [existingSections, setExistingSections] = useState<string[]>([])

  // UI state
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Per-section conflict detection
  const [sectionConflicts, setSectionConflicts] = useState<Record<number, ConflictCheckResult>>({})
  const [localSectionConflicts, setLocalSectionConflicts] = useState<Record<number, ConflictCheckResult>>({})
  const [checkingConflicts, setCheckingConflicts] = useState<Record<number, boolean>>({})
  const conflictTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const lastConflictKeys = useRef<Record<number, string>>({})

  // Debounced per-section conflict check
  const checkSectionConflict = useCallback((idx: number, sec: SectionData) => {
    // Clear existing timer for this section
    if (conflictTimers.current[idx]) clearTimeout(conflictTimers.current[idx])

    const resolved = resolveSectionSchedule(sec)
    const timeRangeError = getTimeRangeError(resolved.startTime, resolved.endTime)

    // Need room, day, and time to check
    if (!sec.roomId || !resolved.dayPattern || !resolved.startTime || !resolved.endTime || !academicYearId || !semester || timeRangeError) {
      setSectionConflicts(prev => { const next = { ...prev }; delete next[idx]; return next })
      setCheckingConflicts(prev => { const next = { ...prev }; delete next[idx]; return next })
      return
    }

    setCheckingConflicts(prev => ({ ...prev, [idx]: true }))

    conflictTimers.current[idx] = setTimeout(async () => {
      try {
        const result = await schedulesApi.checkConflict({
          roomId: Number(sec.roomId),
          dayPattern: resolved.dayPattern,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          academicYearId: Number(academicYearId),
          semester,
          subjectId: subjectId ? Number(subjectId) : undefined,
          section: sec.section || undefined,
        })
        setSectionConflicts(prev => ({ ...prev, [idx]: result }))
      } catch {
        // Silently ignore check-conflict errors
      } finally {
        setCheckingConflicts(prev => ({ ...prev, [idx]: false }))
      }
    }, 800)
  }, [academicYearId, semester, subjectId])

  // Load initial data: first get the active AY, then fetch subjects filtered by its semester
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Get academic years to find the active one
        const ayRes = await academicYearsApi.list({ limit: 50 })
        const current = (ayRes.data as AcademicYear[]).find(a => a.isCurrent) || null
        setActiveAy(current)

        if (current) {
          setAcademicYearId(String(current.id))
          setSemester(current.currentSemester || '')
        }

        const activeSemester = current?.currentSemester || undefined

        // 2. Fetch subjects filtered by department AND the active semester (strict=true for exact department only)
        const [subRes, roomRes] = await Promise.all([
          subjectsApi.list({ limit: 500, department_id: departmentId || undefined, semester: activeSemester, strict: departmentId ? true : undefined }),
          roomsApi.list({ limit: 500, department_id: departmentId || undefined }),
        ])
        setSubjects(subRes.data)
        setRooms(roomRes.data)

        // 3. Load department info if applicable
        if (departmentId) {
          const dept = await departmentsApi.get(Number(departmentId))
          setDepartment(dept as Department)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    init()
  }, [departmentId])

  // When subject changes, fetch existing sections for that subject
  useEffect(() => {
    if (!subjectId || !academicYearId || !semester) {
      setExistingSections([])
      return
    }
    schedulesApi.list({
      limit: 100,
      department_id: departmentId || undefined,
    }).then(res => {
      const matching = res.data.filter(
        (s: { subject: { id: number }; academicYear: { id: number }; semester: string; section: string | null }) =>
          s.subject.id === Number(subjectId) &&
          s.academicYear.id === Number(academicYearId) &&
          s.semester === semester
      )
      setExistingSections(matching.map((s: { section: string | null }) => (s.section || '').toUpperCase()))
    }).catch(() => setExistingSections([]))
  }, [subjectId, academicYearId, semester, departmentId])

  // Generate section columns when section count changes
  const syncSectionsToCount = useCallback((count: number) => {
    setSections((prev) => {
      if (count < 1) return []
      if (prev.length === count) return prev
      if (prev.length > count) return prev.slice(0, count)

      const usedLabels = [...existingSections, ...prev.map((sec) => sec.section)]
      let maxIndex = getMaxSectionIndex(usedLabels)
      const next = [...prev]

      for (let i = prev.length; i < count; i++) {
        maxIndex += 1
        const letter = String.fromCharCode(65 + maxIndex)
        next.push(defaultSection(letter))
      }

      return next
    })
  }, [existingSections])

  useEffect(() => {
    const count = parseInt(sectionCount)
    if (!Number.isNaN(count)) {
      syncSectionsToCount(count)
    } else {
      setSections([])
    }
  }, [sectionCount, syncSectionsToCount])

  // Update a section field
  function updateSection(index: number, field: keyof SectionData, value: string) {
    setSections(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      // If timeSlot changes, set start/end time
      if (field === 'timeSlot' && value !== '') {
        const slot = TIME_SLOTS[Number(value)]
        if (slot) {
          updated[index].startTime = slot.start
          updated[index].endTime = slot.end
        }
      }

      return updated
    })
  }

  function toggleCustomFormat(index: number) {
    setSections(prev => {
      const updated = [...prev]
      const current = updated[index]
      const enableCustom = !current.useCustomFormat

      const presetDays = parseDayPatternToTokens(current.dayPattern)
      const customDays = enableCustom
        ? (current.customDays.length > 0 ? normalizeDayTokens(current.customDays) : presetDays)
        : current.customDays

      updated[index] = {
        ...current,
        useCustomFormat: enableCustom,
        customDays,
        customStartTime: enableCustom ? (current.customStartTime || current.startTime) : current.customStartTime,
        customEndTime: enableCustom ? (current.customEndTime || current.endTime) : current.customEndTime,
      }
      return updated
    })
  }

  function toggleCustomDay(index: number, day: DayToken) {
    setSections(prev => {
      const updated = [...prev]
      const current = updated[index]
      const exists = current.customDays.includes(day)
      const nextDays = exists
        ? current.customDays.filter(d => d !== day)
        : [...current.customDays, day]

      updated[index] = {
        ...current,
        customDays: normalizeDayTokens(nextDays),
      }
      return updated
    })
  }

  function updateCustomTime(index: number, field: 'customStartTime' | 'customEndTime', value: string) {
    setSections(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
      }
      return updated
    })
  }

  function addSection() {
    if (sections.length >= MAX_SECTIONS) return

    const currentCount = parseInt(sectionCount)
    const baseCount = Number.isNaN(currentCount) ? sections.length : Math.max(currentCount, sections.length)
    setSectionCount(String(baseCount + 1))
  }

  function removeSection(index: number) {
    if (sections.length <= 1) return

    setSections((prev) => {
      if (!prev[index]) return prev
      const next = prev.filter((_, i) => i !== index)
      setSectionCount(next.length > 0 ? String(next.length) : '')
      return next
    })

    Object.values(conflictTimers.current).forEach((timer) => clearTimeout(timer))
    conflictTimers.current = {}
    lastConflictKeys.current = {}
    setSectionConflicts({})
    setLocalSectionConflicts({})
    setCheckingConflicts({})
  }

  useEffect(() => {
    const next: Record<number, ConflictCheckResult> = {}

    const resolvedSections = sections.map((sec, idx) => {
      const resolved = resolveSectionSchedule(sec)
      return {
        idx,
        section: sec.section || `${idx + 1}`,
        roomId: sec.roomId,
        dayTokens: parseDayPatternToTokens(resolved.dayPattern),
        startMinutes: parseTimeToMinutes(resolved.startTime),
        endMinutes: parseTimeToMinutes(resolved.endTime),
      }
    })

    const addConflict = (idx: number, message: string) => {
      if (!next[idx]) {
        next[idx] = { hasConflict: true, conflicts: [] }
      }
      next[idx].conflicts.push({ type: 'room_time_conflict', message })
    }

    for (let i = 0; i < resolvedSections.length; i++) {
      const current = resolvedSections[i]
      if (!current.roomId || current.dayTokens.length === 0 || current.startMinutes === null || current.endMinutes === null) {
        continue
      }

      for (let j = i + 1; j < resolvedSections.length; j++) {
        const other = resolvedSections[j]
        if (!other.roomId || other.dayTokens.length === 0 || other.startMinutes === null || other.endMinutes === null) {
          continue
        }

        if (current.roomId !== other.roomId) {
          continue
        }

        const dayOverlap = current.dayTokens.some(day => other.dayTokens.includes(day))
        if (!dayOverlap) {
          continue
        }

        const timeOverlap = current.startMinutes < other.endMinutes && current.endMinutes > other.startMinutes
        if (!timeOverlap) {
          continue
        }

        addConflict(current.idx, `Room/time conflict with Section ${other.section} in this batch.`)
        addConflict(other.idx, `Room/time conflict with Section ${current.section} in this batch.`)
      }
    }

    setLocalSectionConflicts(next)
  }, [sections])

  function getMergedConflicts(idx: number): ConflictCheckResult | null {
    const apiConflicts = sectionConflicts[idx]
    const localConflicts = localSectionConflicts[idx]

    if (!apiConflicts && !localConflicts) {
      return null
    }

    const merged = [
      ...(apiConflicts?.conflicts ?? []),
      ...(localConflicts?.conflicts ?? []),
    ]

    return {
      hasConflict: merged.length > 0,
      conflicts: merged,
    }
  }

  const hasBlockingConflicts = sections.some((_, idx) => getMergedConflicts(idx)?.hasConflict)

  useEffect(() => {
    sections.forEach((sec, idx) => {
      const resolved = resolveSectionSchedule(sec)
      const key = [
        sec.roomId,
        resolved.dayPattern,
        resolved.startTime,
        resolved.endTime,
        academicYearId,
        semester,
        subjectId,
        sec.section,
      ].join('|')

      if (lastConflictKeys.current[idx] === key) {
        return
      }

      lastConflictKeys.current[idx] = key
      checkSectionConflict(idx, sec)
    })

    Object.keys(lastConflictKeys.current).forEach(key => {
      const idx = Number(key)
      if (!sections[idx]) {
        delete lastConflictKeys.current[idx]
      }
    })
  }, [sections, academicYearId, semester, subjectId, checkSectionConflict])

  // Validation
  function validate(): boolean {
    const errs: string[] = []
    if (!subjectId) errs.push('Subject is required.')
    if (!academicYearId) errs.push('Academic Year is required.')
    if (!semester) errs.push('Semester is required.')
    if (sections.length === 0) errs.push('At least one section is required.')

    sections.forEach((sec, i) => {
      const resolved = resolveSectionSchedule(sec)
      const timeRangeError = getTimeRangeError(resolved.startTime, resolved.endTime)
      if (!sec.section.trim()) errs.push(`Section ${i + 1}: Section name is required.`)
      if (!sec.roomId) errs.push(`Section ${i + 1}: Room is required.`)
      if (!resolved.dayPattern) errs.push(`Section ${i + 1}: Day pattern is required.`)
      if (!resolved.startTime || !resolved.endTime) errs.push(`Section ${i + 1}: Time slot is required.`)
      if (timeRangeError) errs.push(`Section ${i + 1}: ${timeRangeError}`)
    })

    setErrors(errs)
    return errs.length === 0
  }

  // Submit all sections
  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return

    setSaving(true)
    setErrors([])
    setWarnings([])

    try {
      const errorMsgs: string[] = []
      const conflictMsgs: string[] = []
      let successCount = 0

      for (const sec of sections) {
        const resolved = resolveSectionSchedule(sec)
        try {
          const response = await schedulesApi.create({
            subjectId: Number(subjectId),
            academicYearId: Number(academicYearId),
            semester,
            roomId: Number(sec.roomId),
            dayPattern: resolved.dayPattern,
            startTime: resolved.startTime,
            endTime: resolved.endTime,
            section: sec.section,
            enrolledStudents: sec.enrolledStudents ? Number(sec.enrolledStudents) : 0,
            status: 'active',
          })
          successCount++
          if (response.meta?.conflicts?.length) {
            response.meta.conflicts.forEach(msg => conflictMsgs.push(`Section ${sec.section}: ${msg}`))
          }
        } catch (err: unknown) {
          errorMsgs.push(`Section ${sec.section}: ${err instanceof Error ? err.message : 'Failed to create.'}`)
        }
      }

      if (errorMsgs.length > 0) {
        setErrors(errorMsgs)
        if (conflictMsgs.length > 0) setWarnings(conflictMsgs)
      } else if (conflictMsgs.length > 0) {
        setWarnings(conflictMsgs)
      } else {
        router.push(departmentId ? `/admin/schedules/department/${departmentId}` : '/admin/schedules')
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedSubject = subjects.find(s => s.id === Number(subjectId))

  const subjectOptions = subjects.map(s => ({ value: String(s.id), label: `${s.code} – ${s.title} (${s.units} units)` }))
  const roomOptions = rooms.map(r => ({ value: String(r.id), label: `${r.code}${r.name ? ' – ' + r.name : ''}` }))

  const semesterLabel = semester === '1st' ? '1st Semester' : semester === '2nd' ? '2nd Semester' : semester === 'Summer' ? 'Summer' : '—'
  const ayLabel = activeAy ? activeAy.year : '—'
  const dayOptions = DAY_PATTERNS.map(d => ({ value: d.value, label: d.label }))
  const timeSlotOptions = TIME_SLOTS.map((t, i) => ({ value: String(i), label: t.label }))
  const sectionCountOptions = Array.from({ length: MAX_SECTIONS }, (_, i) => ({ value: String(i + 1), label: `${i + 1} Section${i > 0 ? 's' : ''}` }))

  const backUrl = departmentId ? `/admin/schedules/department/${departmentId}` : '/admin/schedules'

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Create New Schedule</h1>
            {department && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                  {department.college?.name} – {department.name}
                </span>
              </p>
            )}
          </div>
        </div>
        <Link href={backUrl}>
          <Button variant="secondary">Back to Schedules</Button>
        </Link>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="error">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <AlertTriangle className="h-4 w-4" />
            {errors.length === 1 ? 'Error' : `${errors.length} Error(s) Detected`}
          </div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Alert>
      )}

      {/* Conflict warnings (schedule created but flagged) */}
      {warnings.length > 0 && (
        <Alert variant="warning">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <AlertTriangle className="h-4 w-4" />
            Schedules Created with Conflicts
          </div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <div className="mt-3">
            <Link href={departmentId ? `/admin/schedules/department/${departmentId}` : '/admin/schedules'}>
              <Button size="sm" variant="secondary">View Schedules</Button>
            </Link>
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form Steps */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Subject & Section Details */}
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-lg">1</div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Subject & Section Details</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select the subject and specify section information</p>
                </div>
              </div>

              <div className="space-y-4">
                <SelectDropdown
                  label="Subject"
                  required
                  searchable
                  value={subjectId}
                  onChange={v => setSubjectId(v)}
                  placeholder="Choose a subject..."
                  options={subjectOptions}
                />

                {/* Section count selector */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <Select
                    label="How many sections do you want to create?"
                    value={sectionCount}
                    onChange={e => setSectionCount(e.target.value)}
                    placeholder="Select number of sections..."
                    options={sectionCountOptions}
                  />
                  <p className="mt-2 text-xs text-purple-700 dark:text-purple-300 italic">Select multiple sections to create them all at once with different details</p>
                </div>

                {/* Existing sections info */}
                {existingSections.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-1.5">Existing Sections for this Subject:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {existingSections.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">{s}</span>
                      ))}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1.5 italic">New sections will automatically start from the next available letter</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                    <div className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">
                      {semesterLabel}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Auto-set from active academic year</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
                    <div className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">
                      {ayLabel}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Auto-set from active academic year</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 2: Section Details */}
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-lg">2</div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Section Details</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Configure each section with specific details</p>
                </div>
              </div>

              {sections.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">Please select how many sections you want to create above</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {sections.map((sec, idx) => {
                    const resolved = resolveSectionSchedule(sec)
                    const timeRangeError = getTimeRangeError(resolved.startTime, resolved.endTime)
                    const mergedConflicts = getMergedConflicts(idx)
                    const hasConflict = mergedConflicts?.hasConflict ?? false
                    const conflictCount = mergedConflicts?.conflicts.length ?? 0

                    return (
                    <div key={idx} className={`border-2 rounded-lg p-5 bg-white dark:bg-gray-800 transition relative ${hasConflict ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/20' : mergedConflicts && !hasConflict ? 'border-green-300 dark:border-green-700' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">Section {sec.section || idx + 1}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => toggleCustomFormat(idx)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${sec.useCustomFormat
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                              }`}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            {sec.useCustomFormat ? 'Use Preset' : 'Custom Format'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSection(idx)}
                            aria-label={`Remove section ${sec.section || idx + 1}`}
                            disabled={sections.length <= 1}
                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          {checkingConflicts[idx] && !hasConflict && (
                            <span className="flex items-center gap-1 text-xs text-blue-600">
                              <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                            </span>
                          )}
                          {hasConflict && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                              <XCircle className="h-3.5 w-3.5" /> {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {!checkingConflicts[idx] && mergedConflicts && !hasConflict && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" /> No conflicts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inline conflict alerts */}
                      {hasConflict && mergedConflicts && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <div className="space-y-2">
                            {mergedConflicts.conflicts.map((c, ci) => {
                              const s = c.schedule
                              const isCrossDept = s?.subject && selectedSubject?.department &&
                                !subjects.some(sub => sub.id === s.subject.id)
                              return (
                                <div key={ci} className="text-xs bg-white dark:bg-gray-800 border border-red-100 dark:border-red-800 rounded p-2.5 space-y-1">
                                  {s ? (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">{s.subject.code} — {s.subject.title}</span>
                                        <span className="text-gray-500 dark:text-gray-400">Section {s.section || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {c.type === 'room_time_conflict' && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                                            🏫 Room Conflict
                                          </span>
                                        )}
                                        {c.type === 'faculty_conflict' && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">
                                            👤 Faculty Conflict
                                          </span>
                                        )}
                                        {c.type === 'section_conflict' && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                                            📋 Section Conflict
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                        {c.type === 'room_time_conflict' && (
                                          <>Room <strong>{s.room.code}</strong> is already booked for <strong>{s.subject.code}</strong> on <strong>{s.dayPattern}</strong> at <strong>{formatTime(s.startTime)}–{formatTime(s.endTime)}</strong></>
                                        )}
                                        {c.type === 'faculty_conflict' && (
                                          <><strong>{s.faculty?.fullName || 'Assigned faculty'}</strong> is already teaching <strong>{s.subject.code}</strong> on <strong>{s.dayPattern}</strong> at <strong>{formatTime(s.startTime)}–{formatTime(s.endTime)}</strong></>
                                        )}
                                        {c.type === 'section_conflict' && (
                                          <>Section <strong>{s.section}</strong> of <strong>{s.subject.code}</strong> already has a class on <strong>{s.dayPattern}</strong> at <strong>{formatTime(s.startTime)}–{formatTime(s.endTime)}</strong> in room <strong>{s.room.code}</strong></>
                                        )}
                                      </div>
                                      {isCrossDept && (
                                        <div className="text-amber-600 mt-1 flex items-center gap-1 font-medium">
                                          ⚡ This schedule belongs to another department
                                        </div>
                                      )}
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

                      <div className="space-y-4">
                        <Input
                          label="Section Name"
                          required
                          value={sec.section}
                          onChange={e => updateSection(idx, 'section', e.target.value)}
                          placeholder="e.g., A, B, 1, 2"
                        />

                        <Select
                          label="Room"
                          required
                          value={sec.roomId}
                          onChange={e => updateSection(idx, 'roomId', e.target.value)}
                          placeholder="Select room..."
                          options={roomOptions}
                        />

                        {!sec.useCustomFormat && (
                          <>
                            <Select
                              label="Day Pattern"
                              required
                              value={sec.dayPattern}
                              onChange={e => updateSection(idx, 'dayPattern', e.target.value)}
                              placeholder="Select..."
                              options={dayOptions}
                            />

                            <Select
                              label="Time Slot"
                              required
                              value={sec.timeSlot}
                              onChange={e => updateSection(idx, 'timeSlot', e.target.value)}
                              placeholder="Select time..."
                              options={timeSlotOptions}
                            />
                          </>
                        )}

                        {sec.useCustomFormat && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Custom Day Pattern <span className="text-red-500">*</span>
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {CUSTOM_DAY_OPTIONS.map(day => {
                                  const active = sec.customDays.includes(day.value)
                                  return (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() => toggleCustomDay(idx, day.value)}
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
                                Selected: {resolved.dayPattern || 'None'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Input
                                label="Start Time"
                                required
                                type="time"
                                value={sec.customStartTime}
                                onChange={e => updateCustomTime(idx, 'customStartTime', e.target.value)}
                              />
                              <Input
                                label="End Time"
                                required
                                type="time"
                                value={sec.customEndTime}
                                onChange={e => updateCustomTime(idx, 'customEndTime', e.target.value)}
                              />
                            </div>
                            {timeRangeError && (
                              <p className="text-xs text-red-600 dark:text-red-400">
                                {timeRangeError}
                              </p>
                            )}
                          </>
                        )}

                        <Input
                          label="Enrolled Students"
                          type="number"
                          value={sec.enrolledStudents}
                          onChange={e => updateSection(idx, 'enrolledStudents', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )})}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={addSection}
                      disabled={sections.length >= MAX_SECTIONS}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Section
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Form Actions */}
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex gap-3">
                  <Link href={backUrl}><Button variant="secondary">Cancel</Button></Link>
                  <Button
                    type="submit"
                    disabled={saving || sections.length === 0 || !subjectId || hasBlockingConflicts}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {saving
                      ? 'Creating...'
                      : hasBlockingConflicts
                        ? 'Resolve Conflicts First'
                        : sections.length <= 1
                          ? 'Create Schedule'
                          : `Create ${sections.length} Sections`
                    }
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Info Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Selected Subject Preview */}
            {selectedSubject && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Selected Subject</h3>
                <dl className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Code</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{selectedSubject.code}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Title</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{selectedSubject.title}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Units</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{selectedSubject.units}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100 capitalize">{selectedSubject.type}</dd>
                  </div>
                </dl>
              </Card>
            )}

            {/* Auto Conflict Detection */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Real-Time Conflict Detection</h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                    Conflicts are checked automatically as you select room, day pattern, and time slot for each section.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 font-bold">Checks:</span>
                      <p className="text-gray-700 dark:text-gray-300">Room-time conflicts, faculty conflicts, section conflicts</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">Note:</span>
                      <p className="text-gray-700 dark:text-gray-300">Schedules can still be created with conflicts — they will be flagged</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-5">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Tips for Better Scheduling
              </h4>
              <ul className="space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <li className="flex items-start gap-2"><span className="text-amber-600">&bull;</span>Verify room capacity matches enrollment</li>
                <li className="flex items-start gap-2"><span className="text-amber-600">&bull;</span>Check that times don&apos;t overlap with other classes</li>
                <li className="flex items-start gap-2"><span className="text-amber-600">&bull;</span>Standard class duration is 1–3 hours</li>
                <li className="flex items-start gap-2"><span className="text-amber-600">&bull;</span>MWF classes are typically 1 hour each</li>
                <li className="flex items-start gap-2"><span className="text-amber-600">&bull;</span>TTH classes are typically 1.5 hours each</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function CreateSchedulePage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-5xl space-y-6"><div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /><div className="h-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-xl" /></div>}>
      <CreateSchedulePageContent />
    </Suspense>
  )
}
