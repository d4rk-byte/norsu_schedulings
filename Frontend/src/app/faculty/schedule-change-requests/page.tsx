'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle, Clock3, Loader2, MapPin, Plus, RefreshCw, Settings2, XCircle } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { DAY_PATTERNS, TIME_SLOTS } from '@/lib/constants'
import {
  facultyApi,
  type FacultyScheduleChangeConflictCheckInput,
  type FacultyScheduleChangeRequest,
  type FacultyScheduleChangeRequestInput,
  type FacultyScheduleChangeRoom,
  type FacultyScheduleItem,
} from '@/lib/faculty-api'
import { formatTime } from '@/lib/utils'
import type { ConflictCheckResult } from '@/types'

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

interface RequestFormState {
  scheduleId: string
  dayPattern: string
  timeSlot: string
  startTime: string
  endTime: string
  roomId: string
  section: string
  reason: string
  useCustomFormat: boolean
  customDays: DayToken[]
  customStartTime: string
  customEndTime: string
}

type FacultyRequestSnapshotRoom = {
  code?: string | null
  name?: string | null
}

type FacultyRequestSnapshot = {
  day_pattern?: string | null
  start_time?: string | null
  end_time?: string | null
  section?: string | null
  room?: FacultyRequestSnapshotRoom | null
}

type FacultyRequestedChangesSnapshot = {
  from?: FacultyRequestSnapshot | null
  to?: FacultyRequestSnapshot | null
}

function normalizeDayTokens(tokens: string[]): DayToken[] {
  const unique = Array.from(new Set(tokens.map(token => token.toUpperCase())))
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

function resolveFormSchedule(form: RequestFormState): { dayPattern: string; startTime: string; endTime: string } {
  if (!form.useCustomFormat) {
    return {
      dayPattern: form.dayPattern,
      startTime: form.startTime,
      endTime: form.endTime,
    }
  }

  return {
    dayPattern: normalizeDayTokens(form.customDays).join('-'),
    startTime: form.customStartTime,
    endTime: form.customEndTime,
  }
}

function normalizeTimeValue(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}

function resolveTimeSlotIndex(startTime: string, endTime: string): string {
  const start = normalizeTimeValue(startTime)
  const end = normalizeTimeValue(endTime)
  const index = TIME_SLOTS.findIndex(slot => slot.start === start && slot.end === end)
  return index >= 0 ? String(index) : ''
}

function buildFormState(schedule: FacultyScheduleItem | null): RequestFormState {
  if (!schedule) {
    return {
      scheduleId: '',
      dayPattern: '',
      timeSlot: '',
      startTime: '',
      endTime: '',
      roomId: '',
      section: '',
      reason: '',
      useCustomFormat: false,
      customDays: [],
      customStartTime: '',
      customEndTime: '',
    }
  }

  const dayPattern = schedule.day_pattern ?? ''
  const startTime = normalizeTimeValue(schedule.start_time)
  const endTime = normalizeTimeValue(schedule.end_time)

  return {
    scheduleId: String(schedule.id),
    dayPattern,
    timeSlot: resolveTimeSlotIndex(startTime, endTime),
    startTime,
    endTime,
    roomId: schedule.room?.id ? String(schedule.room.id) : '',
    section: schedule.section ?? '',
    reason: '',
    useCustomFormat: false,
    customDays: parseDayPatternToTokens(dayPattern),
    customStartTime: startTime,
    customEndTime: endTime,
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function requestStatusVariant(status: string): BadgeVariant {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'cancelled') return 'default'
  return 'warning'
}

function approvalStatusVariant(status: string): BadgeVariant {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTimeSafe(value: string | null | undefined): string {
  if (!value) return '—'

  const normalized = normalizeTimeValue(value)
  if (!normalized) return '—'

  return formatTime(normalized)
}

function formatTimeRange(startTime: string | null | undefined, endTime: string | null | undefined): string {
  if (!startTime || !endTime) return '—'
  return `${formatTimeSafe(startTime)} - ${formatTimeSafe(endTime)}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  const withResponse = error as {
    response?: {
      data?: {
        error?: {
          message?: string
          details?: Record<string, string>
        }
        message?: string
      }
    }
    message?: string
  }

  const details = withResponse.response?.data?.error?.details
  const detailMessage = details
    ? Object.values(details).find(message => typeof message === 'string' && message.trim())
    : ''

  return (
    withResponse.response?.data?.error?.message
    || withResponse.response?.data?.message
    || detailMessage
    || withResponse.message
    || fallback
  )
}

function getFacultyRequestSnapshots(request: FacultyScheduleChangeRequest): { from: FacultyRequestSnapshot | null; to: FacultyRequestSnapshot | null } {
  if (!request.requested_changes || typeof request.requested_changes !== 'object') {
    return { from: null, to: null }
  }

  const snapshots = request.requested_changes as FacultyRequestedChangesSnapshot

  return {
    from: snapshots.from && typeof snapshots.from === 'object' ? snapshots.from : null,
    to: snapshots.to && typeof snapshots.to === 'object' ? snapshots.to : null,
  }
}

export default function FacultyScheduleChangeRequestsPage() {
  const [requests, setRequests] = useState<FacultyScheduleChangeRequest[]>([])
  const [schedules, setSchedules] = useState<FacultyScheduleItem[]>([])
  const [rooms, setRooms] = useState<FacultyScheduleChangeRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<RequestFormState>(buildFormState(null))
  const [formError, setFormError] = useState<string | null>(null)
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const roomsPromise = facultyApi.listRooms({ limit: 500 }).catch(() => [] as FacultyScheduleChangeRoom[])

      const [requestItems, scheduleResponse, roomItems] = await Promise.all([
        facultyApi.listScheduleChangeRequests({ limit: 100 }),
        facultyApi.schedule(),
        roomsPromise,
      ])

      setRequests(requestItems)
      setSchedules(scheduleResponse.schedules ?? [])
      setRooms(roomItems)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load schedule change requests.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aDate = Date.parse(a.created_at ?? '')
      const bDate = Date.parse(b.created_at ?? '')
      if (Number.isNaN(aDate) || Number.isNaN(bDate)) return b.id - a.id
      return bDate - aDate
    })
  }, [requests])

  const selectedSchedule = useMemo(() => {
    return schedules.find(schedule => String(schedule.id) === form.scheduleId) ?? null
  }, [schedules, form.scheduleId])

  const scheduleOptions = useMemo(() => {
    return schedules.map((schedule) => {
      const subjectCode = schedule.subject.code || 'SUBJ'
      const dayLabel = schedule.day_pattern_label || schedule.day_pattern || 'No day pattern'
      const start = schedule.start_time_12h || formatTimeSafe(schedule.start_time)
      const end = schedule.end_time_12h || formatTimeSafe(schedule.end_time)
      const roomCode = schedule.room?.code || 'TBA'

      return {
        value: String(schedule.id),
        label: `${subjectCode} • ${dayLabel} • ${start}-${end} • Room ${roomCode}`,
      }
    })
  }, [schedules])

  const roomOptions = useMemo(() => {
    const roomMap = new Map<number, { value: string; label: string }>()

    rooms.forEach((room) => {
      if (!room?.id) return
      if (roomMap.has(room.id)) return

      const roomLabel = [
        room.code,
        room.name,
        room.building,
      ].filter(Boolean).join(' • ')

      roomMap.set(room.id, {
        value: String(room.id),
        label: roomLabel || `Room ${room.id}`,
      })
    })

    schedules.forEach((schedule) => {
      if (!schedule.room?.id) return
      if (roomMap.has(schedule.room.id)) return

      const roomLabel = [
        schedule.room.code,
        schedule.room.name,
        schedule.room.building,
      ].filter(Boolean).join(' • ')

      roomMap.set(schedule.room.id, {
        value: String(schedule.room.id),
        label: roomLabel || `Room ${schedule.room.id}`,
      })
    })

    return Array.from(roomMap.values())
  }, [rooms, schedules])

  const dayPatternOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = DAY_PATTERNS.map(pattern => ({
      value: pattern.value,
      label: pattern.label,
    }))

    if (
      selectedSchedule?.day_pattern
      && !options.some(option => option.value === selectedSchedule.day_pattern)
    ) {
      options.unshift({
        value: selectedSchedule.day_pattern,
        label: selectedSchedule.day_pattern,
      })
    }

    return options
  }, [selectedSchedule])

  const timeSlotOptions = useMemo(() => {
    return TIME_SLOTS.map((slot, index) => ({
      value: String(index),
      label: slot.label,
    }))
  }, [])

  const counts = useMemo(() => {
    return {
      pending: requests.filter(request => request.status === 'pending').length,
      approved: requests.filter(request => request.status === 'approved').length,
      resolved: requests.filter(request => request.status === 'rejected' || request.status === 'cancelled').length,
    }
  }, [requests])

  function openRequestModal() {
    setForm(buildFormState(schedules[0] ?? null))
    setFormError(null)
    setConflictResult(null)
    setCheckingConflicts(false)
    setIsModalOpen(true)
  }

  function closeRequestModal() {
    if (submitting) return
    setIsModalOpen(false)
    setFormError(null)
    setConflictResult(null)
    setCheckingConflicts(false)
  }

  function handleScheduleChange(scheduleId: string) {
    const nextSchedule = schedules.find(schedule => String(schedule.id) === scheduleId) ?? null

    setForm((previous) => {
      if (!nextSchedule) {
        return {
          ...previous,
          scheduleId,
        }
      }

      const dayPattern = nextSchedule.day_pattern ?? ''
      const startTime = normalizeTimeValue(nextSchedule.start_time)
      const endTime = normalizeTimeValue(nextSchedule.end_time)
      const nextCustomDays = parseDayPatternToTokens(dayPattern)

      return {
        ...previous,
        scheduleId,
        dayPattern,
        timeSlot: resolveTimeSlotIndex(startTime, endTime),
        startTime,
        endTime,
        roomId: nextSchedule.room?.id ? String(nextSchedule.room.id) : '',
        section: nextSchedule.section ?? '',
        customDays: nextCustomDays,
        customStartTime: startTime,
        customEndTime: endTime,
      }
    })

    setFormError(null)
    setConflictResult(null)
  }

  function toggleCustomFormat() {
    setForm((previous) => {
      const enableCustom = !previous.useCustomFormat
      const presetDays = parseDayPatternToTokens(previous.dayPattern)

      return {
        ...previous,
        useCustomFormat: enableCustom,
        customDays: enableCustom
          ? (previous.customDays.length > 0 ? normalizeDayTokens(previous.customDays) : presetDays)
          : previous.customDays,
        customStartTime: enableCustom ? (previous.customStartTime || previous.startTime) : previous.customStartTime,
        customEndTime: enableCustom ? (previous.customEndTime || previous.endTime) : previous.customEndTime,
      }
    })

    setFormError(null)
    setConflictResult(null)
  }

  function toggleCustomDay(day: DayToken) {
    setForm((previous) => {
      const exists = previous.customDays.includes(day)
      const nextDays = exists
        ? previous.customDays.filter(value => value !== day)
        : [...previous.customDays, day]

      return {
        ...previous,
        customDays: normalizeDayTokens(nextDays),
      }
    })

    setFormError(null)
    setConflictResult(null)
  }

  useEffect(() => {
    if (!isModalOpen) return

    const resolved = resolveFormSchedule(form)

    if (
      !form.scheduleId
      || !resolved.dayPattern.trim()
      || !resolved.startTime
      || !resolved.endTime
      || !form.roomId
      || resolved.startTime >= resolved.endTime
    ) {
      setConflictResult(null)
      setCheckingConflicts(false)
      return
    }

    setCheckingConflicts(true)

    const timer = setTimeout(async () => {
      const payload: FacultyScheduleChangeConflictCheckInput = {
        schedule_id: Number(form.scheduleId),
        day_pattern: resolved.dayPattern.trim(),
        start_time: resolved.startTime,
        end_time: resolved.endTime,
        room_id: Number(form.roomId),
        section: form.section.trim() || null,
      }

      try {
        const result = await facultyApi.checkScheduleChangeConflict(payload)
        setConflictResult(result)
      } catch {
        setConflictResult(null)
      } finally {
        setCheckingConflicts(false)
      }
    }, 800)

    return () => {
      clearTimeout(timer)
      setCheckingConflicts(false)
    }
  }, [form, isModalOpen])

  function validateForm(): string | null {
    const resolved = resolveFormSchedule(form)

    if (!form.scheduleId) return 'Select a schedule first.'
    if (!resolved.dayPattern.trim()) return 'Day pattern is required.'
    if (!form.useCustomFormat && !form.timeSlot) return 'Time slot is required.'
    if (!resolved.startTime) return 'Start time is required.'
    if (!resolved.endTime) return 'End time is required.'
    if (resolved.startTime >= resolved.endTime) return 'End time must be later than start time.'
    if (!form.roomId) return 'A room selection is required.'

    return null
  }

  async function handleSubmitRequest() {
    const validationMessage = validateForm()
    if (validationMessage) {
      setFormError(validationMessage)
      return
    }

    if (conflictResult?.hasConflict) {
      setFormError('Resolve the detected conflicts before submitting this request.')
      return
    }

    const resolved = resolveFormSchedule(form)

    setSubmitting(true)
    setFormError(null)

    const payload: FacultyScheduleChangeRequestInput = {
      schedule_id: Number(form.scheduleId),
      day_pattern: resolved.dayPattern.trim(),
      start_time: resolved.startTime,
      end_time: resolved.endTime,
      room_id: Number(form.roomId),
      section: form.section.trim() || null,
      reason: form.reason.trim() || undefined,
    }

    try {
      const response = await facultyApi.createScheduleChangeRequest(payload)
      setFeedback(response.message || 'Schedule change request submitted successfully.')
      setIsModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to submit schedule change request.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelRequest(request: FacultyScheduleChangeRequest) {
    if (!request.can_cancel) return

    const confirmed = window.confirm('Cancel this pending request? This action cannot be undone.')
    if (!confirmed) return

    setCancellingId(request.id)

    try {
      const response = await facultyApi.cancelScheduleChangeRequest(request.id)
      setFeedback(response.message || 'Schedule change request cancelled successfully.')
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel the request.'))
    } finally {
      setCancellingId(null)
    }
  }

  if (loading && requests.length === 0 && schedules.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-white">Schedule Change Requests</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Submit changes for your current class schedule and track approval progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadData()}
            loading={loading}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
          <Button
            type="button"
            onClick={openRequestModal}
            icon={<Plus className="h-4 w-4" />}
            disabled={schedules.length === 0}
          >
            New Request
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {feedback && (
        <Alert variant="success" onDismiss={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {schedules.length === 0 && (
        <Alert variant="warning">
          No active schedules were found. You can submit a change request once your teaching schedule is assigned.
          <div className="mt-2">
            <Link href="/faculty/schedule" className="font-medium underline underline-offset-2">
              Open my teaching schedule
            </Link>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card padding="sm">
          <p className="text-sm text-stone-500 dark:text-gray-400">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{counts.pending}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-stone-500 dark:text-gray-400">Approved</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{counts.approved}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-stone-500 dark:text-gray-400">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-stone-700 dark:text-gray-200">{counts.resolved}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="My Request History"
          description={`${sortedRequests.length} request${sortedRequests.length === 1 ? '' : 's'} total`}
        />

        {sortedRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 dark:border-gray-700 p-10 text-center">
            <p className="text-sm text-stone-500 dark:text-gray-400">You have not submitted any schedule change requests yet.</p>
            {schedules.length > 0 && (
              <Button type="button" className="mt-4" onClick={openRequestModal} icon={<Plus className="h-4 w-4" />}>
                Create your first request
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRequests.map((request) => {
              const subjectCode = request.schedule?.subject?.code || 'SUBJ'
              const subjectTitle = request.schedule?.subject?.title || 'Untitled Subject'
              const { from, to } = getFacultyRequestSnapshots(request)

              const currentDayPattern = from?.day_pattern || request.schedule?.day_pattern_label || request.schedule?.day_pattern || '—'
              const currentStartTime = from?.start_time ?? request.schedule?.start_time
              const currentEndTime = from?.end_time ?? request.schedule?.end_time
              const currentRoomCode = from?.room?.code || request.schedule?.room?.code || 'TBA'
              const currentRoomName = from?.room?.name ?? request.schedule?.room?.name
              const currentSection = from?.section ?? request.schedule?.section ?? request.proposal.section ?? '—'

              const proposedDayPattern = to?.day_pattern || request.proposal.day_pattern || '—'
              const proposedStartTime = to?.start_time ?? request.proposal.start_time
              const proposedEndTime = to?.end_time ?? request.proposal.end_time
              const proposedRoomCode = to?.room?.code || request.proposal.room?.code || 'TBA'
              const proposedRoomName = to?.room?.name ?? request.proposal.room?.name
              const proposedSection = to?.section ?? request.proposal.section ?? '—'

              return (
                <div key={request.id} className="rounded-xl border border-stone-200 dark:border-gray-700 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {subjectCode} — {subjectTitle}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-gray-400 mt-1">
                        Submitted: {formatDateTime(request.submitted_at || request.created_at)}
                      </p>
                    </div>
                    <Badge variant={requestStatusVariant(request.status)}>{formatStatusLabel(request.status)}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg bg-stone-50 dark:bg-gray-800/60 p-3">
                      <p className="text-xs font-semibold text-stone-500 dark:text-gray-400 uppercase tracking-wide">
                        Submitted Schedule
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-stone-700 dark:text-gray-200">
                        <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-stone-400" /> {currentDayPattern}</p>
                        <p className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-stone-400" /> {formatTimeRange(currentStartTime, currentEndTime)}</p>
                        <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-stone-400" /> {currentRoomCode}{currentRoomName ? ` (${currentRoomName})` : ''}</p>
                        <p>Section: {currentSection}</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary-50/60 dark:bg-primary-900/20 p-3">
                      <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                        Requested Changes
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-stone-700 dark:text-gray-200">
                        <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary-500" /> {proposedDayPattern}</p>
                        <p className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-primary-500" /> {formatTimeRange(proposedStartTime, proposedEndTime)}</p>
                        <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary-500" /> {proposedRoomCode}{proposedRoomName ? ` (${proposedRoomName})` : ''}</p>
                        <p>Section: {proposedSection}</p>
                      </div>
                    </div>
                  </div>

                  {request.request_reason && (
                    <div className="mt-3 rounded-lg border border-stone-200 dark:border-gray-700 p-3">
                      <p className="text-xs font-semibold text-stone-500 dark:text-gray-400 uppercase tracking-wide">Reason</p>
                      <p className="text-sm text-stone-700 dark:text-gray-200 mt-1 whitespace-pre-wrap">{request.request_reason}</p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={approvalStatusVariant(request.admin_status)}>
                      Admin: {formatStatusLabel(request.admin_status)}
                    </Badge>
                    <Badge variant={approvalStatusVariant(request.department_head_status)}>
                      Department Head: {formatStatusLabel(request.department_head_status)}
                    </Badge>
                    {request.can_cancel && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        className="ml-auto"
                        icon={<XCircle className="h-4 w-4" />}
                        onClick={() => void handleCancelRequest(request)}
                        loading={cancellingId === request.id}
                      >
                        Cancel Request
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        open={isModalOpen}
        onClose={closeRequestModal}
        title="Submit Schedule Change Request"
        description="Choose a class schedule and provide your proposed changes."
        size="lg"
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={closeRequestModal} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitRequest()}
              loading={submitting}
              disabled={schedules.length === 0 || checkingConflicts || conflictResult?.hasConflict === true}
            >
              Submit Request
            </Button>
          </>
        )}
      >
        {formError && (
          <Alert variant="error" className="mb-4">
            {formError}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Select
              label="Class Schedule"
              value={form.scheduleId}
              onChange={(event) => handleScheduleChange(event.target.value)}
              options={scheduleOptions}
              placeholder="Select your class schedule"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-800/50 px-3 py-2">
            <p className="text-xs text-stone-600 dark:text-gray-300">Need a non-standard day/time arrangement?</p>
            <button
              type="button"
              onClick={toggleCustomFormat}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${form.useCustomFormat
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {form.useCustomFormat ? 'Use Preset' : 'Custom Format'}
            </button>
          </div>

          <Select
            label="Proposed Room"
            value={form.roomId}
            onChange={event => setForm(previous => ({ ...previous, roomId: event.target.value }))}
            options={roomOptions}
            placeholder="Select room"
          />

          {!form.useCustomFormat && (
            <Select
              label="Proposed Day Pattern"
              value={form.dayPattern}
              onChange={event => setForm(previous => ({ ...previous, dayPattern: event.target.value }))}
              options={dayPatternOptions}
              placeholder="Select day pattern"
            />
          )}

          {form.useCustomFormat && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-2">
                Custom Day Pattern <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CUSTOM_DAY_OPTIONS.map(day => {
                  const active = form.customDays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleCustomDay(day.value)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${active
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">
                Selected: {normalizeDayTokens(form.customDays).join('-') || 'None'}
              </p>
            </div>
          )}

          {!form.useCustomFormat ? (
            <div className="md:col-span-2">
              <Select
                label="Time Slot"
                value={form.timeSlot}
                onChange={event => {
                  const nextTimeSlot = event.target.value
                  const slot = TIME_SLOTS[Number(nextTimeSlot)]

                  setForm(previous => ({
                    ...previous,
                    timeSlot: nextTimeSlot,
                    startTime: slot?.start ?? '',
                    endTime: slot?.end ?? '',
                  }))
                }}
                options={timeSlotOptions}
                placeholder="Select time..."
              />
            </div>
          ) : (
            <>
              <Input
                label="Proposed Start Time"
                type="time"
                value={form.customStartTime}
                onChange={event => setForm(previous => ({ ...previous, customStartTime: event.target.value }))}
              />

              <Input
                label="Proposed End Time"
                type="time"
                value={form.customEndTime}
                onChange={event => setForm(previous => ({ ...previous, customEndTime: event.target.value }))}
              />
            </>
          )}

          <Input
            label="Proposed Section"
            placeholder="e.g. A"
            value={form.section}
            onChange={event => setForm(previous => ({ ...previous, section: event.target.value }))}
          />

          <div className="md:col-span-2">
            <Textarea
              label="Reason (optional)"
              placeholder="Explain why this change is needed"
              value={form.reason}
              onChange={event => setForm(previous => ({ ...previous, reason: event.target.value }))}
              maxLength={2000}
            />
          </div>

          <div className="md:col-span-2">
            {checkingConflicts ? (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-200 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking schedule conflicts...
              </div>
            ) : conflictResult?.hasConflict ? (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Conflicts detected ({conflictResult.conflicts.length})
                </p>
                <div className="mt-2 space-y-2">
                  {conflictResult.conflicts.map((conflict, index) => {
                    const schedule = conflict.schedule
                    return (
                      <div key={`${conflict.type}-${index}`} className="text-xs bg-white dark:bg-gray-900/60 border border-red-100 dark:border-red-900/60 rounded p-2.5 space-y-1">
                        {schedule ? (
                          <>
                            {(() => {
                              const scheduleData = schedule as unknown as {
                                dayPatternLabel?: string | null
                                dayPattern?: string | null
                                day_pattern_label?: string | null
                                day_pattern?: string | null
                                startTime?: string | null
                                endTime?: string | null
                                start_time?: string | null
                                end_time?: string | null
                                section?: string | null
                                room?: { code?: string | null } | null
                                faculty?: { fullName?: string | null } | null
                                subject?: { code?: string | null; title?: string | null } | null
                              }

                              const subjectCode = scheduleData.subject?.code || 'SUBJ'
                              const subjectTitle = scheduleData.subject?.title || 'Untitled Subject'
                              const sectionLabel = scheduleData.section || '—'
                              const roomCode = scheduleData.room?.code || 'TBA'
                              const dayLabel =
                                scheduleData.dayPatternLabel
                                || scheduleData.day_pattern_label
                                || scheduleData.dayPattern
                                || scheduleData.day_pattern
                                || 'N/A'
                              const startTime = scheduleData.startTime || scheduleData.start_time
                              const endTime = scheduleData.endTime || scheduleData.end_time
                              const facultyName = scheduleData.faculty?.fullName || 'Assigned faculty'

                              return (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{subjectCode} — {subjectTitle}</span>
                                    <span className="text-gray-500 dark:text-gray-400">Section {sectionLabel}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {conflict.type === 'room_time_conflict' && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                                        Room Conflict
                                      </span>
                                    )}
                                    {conflict.type === 'faculty_conflict' && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">
                                        Faculty Conflict
                                      </span>
                                    )}
                                    {conflict.type === 'section_conflict' && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                                        Section Conflict
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {conflict.type === 'room_time_conflict' && (
                                      <>
                                        Room <strong>{roomCode}</strong> is already booked for <strong>{subjectCode}</strong> on <strong>{dayLabel}</strong> at <strong>{formatTimeSafe(startTime)} - {formatTimeSafe(endTime)}</strong>.
                                      </>
                                    )}
                                    {conflict.type === 'faculty_conflict' && (
                                      <>
                                        <strong>{facultyName}</strong> is already teaching <strong>{subjectCode}</strong> on <strong>{dayLabel}</strong> at <strong>{formatTimeSafe(startTime)} - {formatTimeSafe(endTime)}</strong>.
                                      </>
                                    )}
                                    {conflict.type === 'section_conflict' && (
                                      <>
                                        Section <strong>{sectionLabel}</strong> of <strong>{subjectCode}</strong> already has a class on <strong>{dayLabel}</strong> at <strong>{formatTimeSafe(startTime)} - {formatTimeSafe(endTime)}</strong> in room <strong>{roomCode}</strong>.
                                      </>
                                    )}
                                    {conflict.type !== 'room_time_conflict' && conflict.type !== 'faculty_conflict' && conflict.type !== 'section_conflict' && (
                                      <>
                                        {conflict.message || 'Conflict detected.'}
                                      </>
                                    )}
                                  </div>
                                </>
                              )
                            })()}
                          </>
                        ) : (
                          <div className="text-red-600">{conflict.message || 'Conflict detected.'}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : conflictResult ? (
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                No conflicts detected.
              </div>
            ) : null}
          </div>
        </div>

        {selectedSchedule && (
          <div className="mt-4 rounded-lg border border-stone-200 dark:border-gray-700 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-gray-400">Current Selection</p>
            <p className="mt-1 text-sm text-stone-700 dark:text-gray-200">
              {selectedSchedule.subject.code} — {selectedSchedule.subject.title}
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">
              {selectedSchedule.day_pattern_label} | {selectedSchedule.start_time_12h} - {selectedSchedule.end_time_12h} | Room {selectedSchedule.room.code}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
