'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, Building2, Check, Eye, FileDown, Layers, Loader2, Plus, Search } from 'lucide-react'
import { useCrudList } from '@/hooks/useCrudList'
import { departmentsApi, reportsApi, schedulesApi } from '@/lib/admin-api'
import { formatTime } from '@/lib/utils'
import type { Department, Schedule } from '@/types'

interface FacultyLoad {
  id: number
  fullName: string
  employeeId: string | null
  department: string | null
  position: string | null
  isActive: boolean
  createdAt: string | null
  assignedCount: number
  totalHours: number
  totalUnits: number
  scheduleCount: number
  isOverloaded: boolean
}

const DAY_TOKEN_ORDER = ['M', 'T', 'W', 'TH', 'F', 'SAT', 'SUN'] as const

function extractDayTokens(pattern: string | null | undefined): string[] {
  if (!pattern) return []

  let normalized = pattern.toUpperCase().trim()
  normalized = normalized.replace(/\([^)]*\)/g, '')

  if (/\b(MON|M)\s*-\s*(FRI|F)\b/.test(normalized) || normalized.includes('WEEKDAY')) {
    return ['M', 'T', 'W', 'TH', 'F']
  }

  if (/\b(MON|M)\s*-\s*SAT\b/.test(normalized)) {
    return ['M', 'T', 'W', 'TH', 'F', 'SAT']
  }

  if (normalized.includes('WEEKEND')) {
    return ['SAT', 'SUN']
  }

  normalized = normalized
    .replace(/MONDAY/g, 'MON')
    .replace(/TUESDAY/g, 'TUE')
    .replace(/WEDNESDAY/g, 'WED')
    .replace(/THURSDAY/g, 'THU')
    .replace(/FRIDAY/g, 'FRI')
    .replace(/SATURDAY/g, 'SAT')
    .replace(/SUNDAY/g, 'SUN')

  const compact = normalized.replace(/[^A-Z]/g, '')
  if (!compact) return []

  const tokenMap3: Record<string, string> = {
    MON: 'M',
    TUE: 'T',
    WED: 'W',
    THU: 'TH',
    FRI: 'F',
    SAT: 'SAT',
    SUN: 'SUN',
  }

  const tokenMap2: Record<string, string> = {
    MO: 'M',
    TU: 'T',
    WE: 'W',
    TH: 'TH',
    FR: 'F',
    SA: 'SAT',
    SU: 'SUN',
  }

  const tokens: string[] = []
  let i = 0

  while (i < compact.length) {
    const chunk3 = compact.slice(i, i + 3)
    if (tokenMap3[chunk3]) {
      tokens.push(tokenMap3[chunk3])
      i += 3
      continue
    }

    const chunk2 = compact.slice(i, i + 2)
    if (tokenMap2[chunk2]) {
      tokens.push(tokenMap2[chunk2])
      i += 2
      continue
    }

    const char = compact[i]
    if (char === 'M' || char === 'T' || char === 'W' || char === 'F') {
      tokens.push(char)
    } else if (char === 'S') {
      tokens.push('SAT')
    }

    i += 1
  }

  const uniqueTokens = Array.from(new Set(tokens))
  return DAY_TOKEN_ORDER.filter((token) => uniqueTokens.includes(token))
}

function hasDayOverlap(patternA: string | null | undefined, patternB: string | null | undefined): boolean {
  const daysA = extractDayTokens(patternA)
  const daysB = extractDayTokens(patternB)
  if (daysA.length === 0 || daysB.length === 0) return false
  return daysA.some((day) => daysB.includes(day))
}

function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const [h, m] = value.split(':')
  const hours = Number(h)
  const minutes = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return (hours * 60) + minutes
}

function hasTimeOverlap(scheduleA: Schedule, scheduleB: Schedule): boolean {
  const startA = toMinutes(scheduleA.startTime)
  const endA = toMinutes(scheduleA.endTime)
  const startB = toMinutes(scheduleB.startTime)
  const endB = toMinutes(scheduleB.endTime)

  if (startA === null || endA === null || startB === null || endB === null) return false
  return startA < endB && endA > startB
}

export default function FacultyLoadingPage() {
  const list = useCrudList<FacultyLoad>((p) => schedulesApi.facultyLoading(p))
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [summary, setSummary] = useState({ totalSchedules: 0, assignedSchedules: 0, unassignedSchedules: 0 })
  const [showDepartmentModal, setShowDepartmentModal] = useState(true)
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [selectedCollegeId, setSelectedCollegeId] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyLoad | null>(null)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [loadedSchedules, setLoadedSchedules] = useState<Schedule[]>([])
  const [unassignedSchedules, setUnassignedSchedules] = useState<Schedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<number[]>([])
  const [pendingScheduleIds, setPendingScheduleIds] = useState<number[]>([])
  const [modalScheduleSearch, setModalScheduleSearch] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [facultyConflictIds, setFacultyConflictIds] = useState<number[]>([])
  const [facultyConflictMessages, setFacultyConflictMessages] = useState<Record<number, string>>({})
  const [togglingOverloadIds, setTogglingOverloadIds] = useState<number[]>([])

  useEffect(() => {
    departmentsApi.list({ limit: 300, sort: 'name', direction: 'asc' })
      .then((r) => setDepartments(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedDepartmentId) {
      list.setExtraParams({})
      setSummary({ totalSchedules: 0, assignedSchedules: 0, unassignedSchedules: 0 })
      return
    }

    const listParams = { department_id: Number(selectedDepartmentId), include_group: true }
    list.setExtraParams(listParams)

    // Cards should always reflect the exact selected department only.
    const summaryParams = { department_id: Number(selectedDepartmentId), include_group: false }
    schedulesApi.facultyLoading(summaryParams).then((res: unknown) => {
      const raw = res as { summary?: { totalSchedules?: number; assignedSchedules?: number; unassignedSchedules?: number } }
      setSummary({
        totalSchedules: raw.summary?.totalSchedules ?? 0,
        assignedSchedules: raw.summary?.assignedSchedules ?? 0,
        unassignedSchedules: raw.summary?.unassignedSchedules ?? 0,
      })
    }).catch(() => {
      setSummary({ totalSchedules: 0, assignedSchedules: 0, unassignedSchedules: 0 })
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartmentId])

  const selectedDepartment = useMemo(
    () => departments.find((d) => String(d.id) === selectedDepartmentId) || null,
    [departments, selectedDepartmentId],
  )

  const filteredDepartments = useMemo(() => {
    let list = departments
    if (selectedCollegeId) {
      list = list.filter((d) => String(d.college?.id || '') === selectedCollegeId)
    }
    if (!departmentSearch.trim()) return list

    const q = departmentSearch.toLowerCase()
    return list.filter((d) =>
      d.name.toLowerCase().includes(q)
      || d.code.toLowerCase().includes(q)
      || (d.college?.name || '').toLowerCase().includes(q),
    )
  }, [departments, selectedCollegeId, departmentSearch])

  const collegeOptions = useMemo(() => {
    const seen = new Map<number, string>()
    departments.forEach((d) => {
      if (d.college?.id && d.college?.name) {
        seen.set(d.college.id, d.college.name)
      }
    })
    const items = Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: String(id), label: name }))
    return [{ value: '', label: 'All Colleges' }, ...items]
  }, [departments])

  function chooseDepartment(id: string) {
    setSelectedDepartmentId(id)
    setShowDepartmentModal(false)
    setDepartmentSearch('')
  }

  async function loadFacultySchedules(faculty: FacultyLoad) {
    if (!selectedDepartmentId) return
    const departmentId = Number(selectedDepartmentId)
    setLoadingAssignments(true)
    setActionMessage('')
    setSelectedScheduleIds([])
    setPendingScheduleIds([])
    setFacultyConflictIds([])
    setFacultyConflictMessages({})
    try {
      // Use one consistent scope so loading, assigning, and unassigning follow the same rules.
      const scopedRes = await schedulesApi.list({
        department_id: Number(selectedDepartmentId),
        include_group: true,
        limit: 2000,
      })

      const scopedSchedules = scopedRes.data as Schedule[]
      const loaded = scopedSchedules.filter((s) => s.faculty?.id === faculty.id)
      const unassigned = scopedSchedules.filter((s) => !s.faculty && s.subject.department?.id === departmentId)
      setLoadedSchedules(loaded)
      setUnassignedSchedules(unassigned)
    } catch {
      setLoadedSchedules([])
      setUnassignedSchedules([])
    }
    setLoadingAssignments(false)
  }

  function openAssignSchedules(faculty: FacultyLoad) {
    setSelectedFaculty(faculty)
    setModalScheduleSearch('')
    setActionMessage('')
    setShowAssignModal(true)
    loadFacultySchedules(faculty)
  }

  function openViewSchedules(faculty: FacultyLoad) {
    setSelectedFaculty(faculty)
    setModalScheduleSearch('')
    setActionMessage('')
    setShowViewModal(true)
    loadFacultySchedules(faculty)
  }

  async function viewTeachingLoadPdf() {
    if (!selectedFaculty) return

    setDownloadingPdf(true)
    try {
      const blob = await reportsApi.teachingLoadPdf(selectedFaculty.id)
      const url = window.URL.createObjectURL(blob)
      // Open inline PDF preview first; user can download from the browser PDF viewer.
      const previewWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!previewWindow) {
        setActionMessage('Popup blocked. Please allow popups to preview the PDF.')
      }
      // Delay revocation so the new tab has enough time to load the blob URL.
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000)
    } catch {
      setActionMessage('Could not open teaching load PDF preview. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  function toggleSchedule(id: number) {
    setSelectedScheduleIds((prev) => {
      if (prev.includes(id)) {
        // Clear stale conflict hint when user unselects the schedule.
        setFacultyConflictIds((conflicts) => conflicts.filter((x) => x !== id))
        setFacultyConflictMessages((messages) => {
          const next = { ...messages }
          delete next[id]
          return next
        })
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  function toggleAllUnassigned() {
    const visibleIds = modalFilteredUnassigned.map((s) => s.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedScheduleIds.includes(id))

    if (allVisibleSelected) {
      setSelectedScheduleIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedScheduleIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  async function handleAssign() {
    if (!selectedFaculty || selectedScheduleIds.length === 0) return
    if (!selectedDepartmentId) return
    const assignIds = selectedScheduleIds
    const selectedSchedules = unassignedSchedules.filter((s) => assignIds.includes(s.id))
    setActionMessage('Checking faculty conflicts...')

    const checks = await Promise.all(selectedSchedules.map(async (s) => {
      try {
        const result = await schedulesApi.checkConflict({
          roomId: s.room.id,
          facultyId: selectedFaculty.id,
          dayPattern: s.dayPattern || '',
          startTime: s.startTime,
          endTime: s.endTime,
          academicYearId: s.academicYear.id,
          semester: s.semester,
          subjectId: s.subject.id,
          section: s.section || undefined,
          excludeId: s.id,
        })
        const facultyConflicts = result.conflicts.filter((c) => c.type === 'faculty_conflict')
        return {
          id: s.id,
          hasFacultyConflict: facultyConflicts.length > 0,
          message: facultyConflicts[0]?.message || 'Faculty has a time conflict with this schedule.',
        }
      } catch {
        return { id: s.id, hasFacultyConflict: false, message: '' }
      }
    }))

    const blockedIds = checks.filter((c) => c.hasFacultyConflict).map((c) => c.id)
    const blockedMap = checks
      .filter((c) => c.hasFacultyConflict)
      .reduce<Record<number, string>>((acc, c) => {
        acc[c.id] = c.message
        return acc
      }, {})

    setFacultyConflictIds(blockedIds)
    setFacultyConflictMessages(blockedMap)

    const safeAssignIds = assignIds.filter((id) => !blockedIds.includes(id))
    if (safeAssignIds.length === 0) {
      setActionMessage('No schedules were assigned. All selected schedules have faculty time conflicts.')
      return
    }

    const idsSet = new Set(assignIds)
    const moving = unassignedSchedules.filter((s) => idsSet.has(s.id))
    const safeSet = new Set(safeAssignIds)
    const safeMoving = moving.filter((s) => safeSet.has(s.id))

    // Optimistic update to make assignment feel instant.
    setLoadedSchedules((prev) => [...safeMoving, ...prev])
    setUnassignedSchedules((prev) => prev.filter((s) => !safeSet.has(s.id)))
    setSummary((prev) => ({
      ...prev,
      assignedSchedules: prev.assignedSchedules + safeMoving.length,
      unassignedSchedules: Math.max(0, prev.unassignedSchedules - safeMoving.length),
    }))
    setSelectedScheduleIds(blockedIds)

    setAssigning(true)
    setActionMessage(`Assigning ${safeAssignIds.length} schedule${safeAssignIds.length > 1 ? 's' : ''}...${blockedIds.length > 0 ? ` (${blockedIds.length} blocked by faculty conflicts)` : ''}`)
    try {
      await Promise.all(
        safeAssignIds.map((id) => schedulesApi.assignFaculty(id, {
          facultyId: selectedFaculty.id,
          departmentId: Number(selectedDepartmentId),
          includeGroup: true,
        }))
      )
      await loadFacultySchedules(selectedFaculty)
      list.refresh()
    } catch {
      await loadFacultySchedules(selectedFaculty)
      setActionMessage('Could not assign some schedules. Please try again.')
      setSummary((prev) => ({
        ...prev,
        assignedSchedules: Math.max(0, prev.assignedSchedules - safeMoving.length),
        unassignedSchedules: prev.unassignedSchedules + safeMoving.length,
      }))
    }
    setAssigning(false)
    if (blockedIds.length > 0) {
      setActionMessage(`${blockedIds.length} schedule${blockedIds.length > 1 ? 's' : ''} were skipped due to faculty conflicts.`)
    } else {
      setActionMessage('')
    }
  }

  async function handleUnassign(id: number) {
    if (!selectedFaculty || !selectedDepartmentId) return
    if (pendingScheduleIds.includes(id)) return

    const target = loadedSchedules.find((s) => s.id === id)
    if (!target) return

    const departmentId = Number(selectedDepartmentId)
    const targetDepartmentId = target.subject.department?.id ?? 0
    if (!targetDepartmentId || targetDepartmentId !== departmentId) {
      setActionMessage('You can only modify schedules from the selected department.')
      return
    }

    setPendingScheduleIds((prev) => [...prev, id])

    // Optimistic update to avoid modal flicker.
    setLoadedSchedules((prev) => prev.filter((s) => s.id !== id))
    setUnassignedSchedules((prev) => {
      if (target.subject.department?.id !== departmentId) return prev
      return [target, ...prev]
    })
    setSummary((prev) => ({
      ...prev,
      assignedSchedules: Math.max(0, prev.assignedSchedules - 1),
      unassignedSchedules: prev.unassignedSchedules + 1,
    }))

    try {
      await schedulesApi.assignFaculty(id, {
        facultyId: null,
        departmentId: Number(selectedDepartmentId),
        includeGroup: true,
      })
      list.refresh()
    } catch {
      await loadFacultySchedules(selectedFaculty)
      setSummary((prev) => ({
        ...prev,
        assignedSchedules: prev.assignedSchedules + 1,
        unassignedSchedules: Math.max(0, prev.unassignedSchedules - 1),
      }))
      setActionMessage('Could not unassign schedule. Please try again.')
    }
    setPendingScheduleIds((prev) => prev.filter((x) => x !== id))
  }

  async function handleToggleOverload(id: number) {
    if (togglingOverloadIds.includes(id)) return

    const current = loadedSchedules.find((s) => s.id === id)
    if (!current) return

    const departmentId = Number(selectedDepartmentId)
    const scheduleDepartmentId = current.subject.department?.id ?? 0
    if (!scheduleDepartmentId || scheduleDepartmentId !== departmentId) {
      setActionMessage('You can only modify schedules from the selected department.')
      return
    }

    const nextValue = !current.isOverload
    setTogglingOverloadIds((prev) => [...prev, id])

    // Optimistic UI for immediate feedback.
    setLoadedSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, isOverload: nextValue } : s)))

    try {
      const result = await schedulesApi.toggleOverload(id)
      setLoadedSchedules((prev) => prev.map((s) => (
        s.id === id ? { ...s, isOverload: result.isOverload } : s
      )))
    } catch {
      setLoadedSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, isOverload: current.isOverload } : s)))
      setActionMessage('Could not update overload status. Please try again.')
    }

    setTogglingOverloadIds((prev) => prev.filter((x) => x !== id))
  }

  const modalFilteredLoaded = useMemo(() => {
    const q = modalScheduleSearch.trim().toLowerCase()
    if (!q) return loadedSchedules
    return loadedSchedules.filter((s) =>
      s.subject.code.toLowerCase().includes(q)
      || s.subject.title.toLowerCase().includes(q)
      || (s.section || '').toLowerCase().includes(q)
      || (s.room?.code || '').toLowerCase().includes(q),
    )
  }, [loadedSchedules, modalScheduleSearch])

  const modalFilteredUnassigned = useMemo(() => {
    const q = modalScheduleSearch.trim().toLowerCase()
    if (!q) return unassignedSchedules
    return unassignedSchedules.filter((s) =>
      s.subject.code.toLowerCase().includes(q)
      || s.subject.title.toLowerCase().includes(q)
      || (s.section || '').toLowerCase().includes(q)
      || (s.room?.code || '').toLowerCase().includes(q),
    )
  }, [unassignedSchedules, modalScheduleSearch])

  const liveLoad = useMemo(() => {
    const units = loadedSchedules.reduce((sum, s) => sum + (s.subject?.units || 0), 0)
    const hours = loadedSchedules.reduce((sum, s) => {
      const start = s.startTime?.split(':').map(Number)
      const end = s.endTime?.split(':').map(Number)
      if (!start || !end || start.length < 2 || end.length < 2) return sum
      const startMinutes = start[0] * 60 + start[1]
      const endMinutes = end[0] * 60 + end[1]
      const diff = Math.max(0, endMinutes - startMinutes)
      return sum + diff / 60
    }, 0)
    return { count: loadedSchedules.length, units, hours: Number(hours.toFixed(1)) }
  }, [loadedSchedules])

  const conflictScheduleIds = useMemo(() => {
    const ids = new Set<number>()

    for (let i = 0; i < loadedSchedules.length; i += 1) {
      for (let j = i + 1; j < loadedSchedules.length; j += 1) {
        const a = loadedSchedules[i]
        const b = loadedSchedules[j]

        if (hasDayOverlap(a.dayPattern || a.dayPatternLabel, b.dayPattern || b.dayPatternLabel) && hasTimeOverlap(a, b)) {
          ids.add(a.id)
          ids.add(b.id)
        }
      }
    }

    return ids
  }, [loadedSchedules])

  const conflictCount = conflictScheduleIds.size

  const selectedDepartmentIdNumber = Number(selectedDepartmentId || 0)

  const columns: Column<FacultyLoad>[] = [
    { key: 'fullName', header: 'Faculty', sortable: true, render: (f) => <div><span className="font-medium text-gray-900 dark:text-gray-100">{f.fullName}</span></div> },
    { key: 'employeeId', header: 'Employee ID', sortable: true, render: (f) => f.employeeId || 'N/A' },
    { key: 'position', header: 'Position', sortable: true, render: (f) => f.position || 'N/A' },
    { key: 'assignedCount', header: 'Assigned', sortable: true, render: (f) => <Badge variant="primary">{f.assignedCount ?? f.scheduleCount}</Badge> },
    { key: 'totalUnits', header: 'Units', sortable: true, render: (f) => f.totalUnits },
    { key: 'totalHours', header: 'Hours/Week', sortable: true, render: (f) => <span className={f.totalHours > 24 ? 'text-red-600 font-semibold' : ''}>{f.totalHours}</span> },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openViewSchedules(f)
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600"
            title="View schedules"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openAssignSchedules(f)
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-600"
            title="Assign schedules"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Modal
        open={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        title="Select Department"
        description="Choose which department you want to manage for faculty loading"
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-3">
            <Select
              value={selectedCollegeId}
              onChange={(e) => setSelectedCollegeId(e.target.value)}
              options={collegeOptions}
              className="text-sm"
            />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                placeholder="Search departments..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {filteredDepartments.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No departments found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1">
              {filteredDepartments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => chooseDepartment(String(dept.id))}
                  className={`text-left p-4 border-2 rounded-lg transition-all ${String(dept.id) === selectedDepartmentId
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{dept.code}</span>
                      </div>
                      <h4 className="mt-2 font-semibold text-gray-900 dark:text-gray-100 truncate">{dept.name}</h4>
                      <p className="text-xs text-gray-500 mt-1 truncate">{dept.college?.name || 'No College'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {dept.departmentGroup ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"><Layers className="h-3 w-3" />{dept.departmentGroup.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">No group</span>
                        )}
                      </div>
                    </div>
                    {String(dept.id) === selectedDepartmentId && (
                      <span className="h-6 w-6 rounded-full bg-primary-600 text-white inline-flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Faculty Loading</h1>
          <p className="mt-1 text-sm text-gray-500">
            {selectedDepartment
              ? selectedDepartment.name
              : 'Select a department to manage faculty assignments'}
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setShowDepartmentModal(true)}>Change Department</Button>
        </div>
      </div>

      <Card>
        <div className="w-full md:w-md">
          <div className="text-sm text-gray-500">Department</div>
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {selectedDepartment ? `${selectedDepartment.code} - ${selectedDepartment.name}` : 'Not selected'}
          </div>
        </div>
      </Card>

      {!selectedDepartmentId ? (
        <Card>
          <div className="py-8 text-center text-sm text-gray-500">Pick a department to load faculty assignments.</div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-sm text-gray-500">Total Schedules</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{summary.totalSchedules}</div>
            </Card>
            <Card>
              <div className="text-sm text-gray-500">Assigned</div>
              <div className="text-3xl font-bold text-green-600">{summary.assignedSchedules}</div>
            </Card>
            <Card>
              <div className="text-sm text-gray-500">Unassigned</div>
              <div className="text-3xl font-bold text-amber-600">{summary.unassignedSchedules}</div>
            </Card>
          </div>

      <Card>
        <CardHeader title="Faculty Load Summary" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search faculty..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(f) => f.id} loading={list.loading} sort={list.sort} onSort={list.setSort} emptyTitle="No faculty loading data" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <Modal
        open={showViewModal}
        onClose={() => {
          if (downloadingPdf || loadingAssignments) return
          setShowViewModal(false)
        }}
        title={selectedFaculty ? `Schedules for ${selectedFaculty.fullName}` : 'Faculty schedules'}
        size="xl"
      >
        {!selectedFaculty ? (
          <div className="text-sm text-gray-500">Select a faculty member to view schedules.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-gray-500">Current Load</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{liveLoad.count} schedules • {liveLoad.units} units • {liveLoad.hours} hrs/week</div>
              </div>
              <Button onClick={viewTeachingLoadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Opening PDF...</span> : <span className="inline-flex items-center gap-2"><FileDown className="h-4 w-4" />View Teaching Load PDF</span>}
              </Button>
            </div>

            {conflictCount > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                <div className="inline-flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {conflictCount} conflicting schedule{conflictCount > 1 ? 's' : ''} detected for this faculty.
                </div>
              </div>
            )}

            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={modalScheduleSearch}
                onChange={(e) => setModalScheduleSearch(e.target.value)}
                placeholder="Search schedules..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            {loadingAssignments ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading schedules...</div>
            ) : modalFilteredLoaded.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">No assigned schedules found.</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                {modalFilteredLoaded.map((s) => {
                  const hasConflict = conflictScheduleIds.has(s.id)

                  return (
                  <div key={s.id} className={`p-4 ${hasConflict ? 'bg-red-50/80 dark:bg-red-900/20 border-l-2 border-red-400' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{s.subject.code} {s.section ? `- ${s.section}` : ''}</div>
                      {s.subject.department?.name && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                          {s.subject.department.name}
                        </span>
                      )}
                      {hasConflict && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          CONFLICT
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{s.subject.title}</div>
                    {hasConflict && (
                      <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">
                        Time/day overlap detected with another loaded schedule.
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span>{s.subject.units} units</span>
                      <span>•</span>
                      <span>{s.dayPatternLabel || s.dayPattern || '—'}</span>
                      <span>•</span>
                      <span>{formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                      <span>•</span>
                      <span>{s.room?.code || 'No room'}</span>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showAssignModal}
        onClose={() => {
          if (assigning || pendingScheduleIds.length > 0) return
          setShowAssignModal(false)
        }}
        title={selectedFaculty ? `Assign schedules to ${selectedFaculty.fullName}` : 'Assign schedules'}
        size="full"
      >
        {!selectedFaculty ? (
          <div className="text-sm text-gray-500">Select a faculty member to assign schedules.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Employee ID</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedFaculty.employeeId || 'N/A'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Current Load</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{liveLoad.count} schedules • {liveLoad.units} units • {liveLoad.hours} hrs/week</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={modalScheduleSearch}
                  onChange={(e) => setModalScheduleSearch(e.target.value)}
                  placeholder="Search loaded or unassigned schedules..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              {actionMessage && <div className="text-xs text-gray-500">{actionMessage}</div>}
            </div>

            {loadingAssignments ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading schedules...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Loaded subjects */}
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
                  <div className="px-4 py-3 border-b border-green-200 dark:border-green-800 flex items-center justify-between">
                    <div className="font-semibold text-green-800 dark:text-green-200">Loaded Subjects</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-700 dark:text-green-300">{modalFilteredLoaded.length} subjects</span>
                      {conflictCount > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-green-100 dark:divide-green-900/40">
                    {modalFilteredLoaded.length === 0 ? (
                      <div className="p-4 text-sm text-green-700 dark:text-green-200">No loaded subjects.</div>
                    ) : (
                      modalFilteredLoaded.map((s) => {
                        const scheduleDepartmentId = s.subject.department?.id ?? 0
                        const isExternal = selectedDepartmentIdNumber > 0 && scheduleDepartmentId !== selectedDepartmentIdNumber
                        const hasConflict = conflictScheduleIds.has(s.id)
                        const rowStateClass = hasConflict
                          ? 'bg-red-50/80 dark:bg-red-900/20 border-l-2 border-red-400'
                          : s.isOverload
                            ? 'bg-amber-50/70 dark:bg-amber-900/10'
                            : ''

                        return (
                        <div key={s.id} className={`p-4 flex items-start justify-between gap-3 transition-colors duration-150 ${rowStateClass}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{s.subject.code} {s.section ? `- ${s.section}` : ''}</div>
                              {s.subject.department?.name && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                                  {s.subject.department.name}
                                </span>
                              )}
                              {hasConflict && (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                  CONFLICT
                                </span>
                              )}
                              {isExternal && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                                  View only
                                </span>
                              )}
                              {s.isOverload && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  OVERLOAD
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">{s.subject.title}</div>
                            {hasConflict && (
                              <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">
                                Time/day overlap detected with another loaded schedule.
                              </div>
                            )}
                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                              <span>{s.subject.units} units</span>
                              <span>•</span>
                              <span>{s.dayPatternLabel || s.dayPattern || '—'}</span>
                              <span>•</span>
                              <span>{formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                              <span>•</span>
                              <span>{s.room?.code}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleOverload(s.id)}
                              title={isExternal ? 'Schedules from other departments are view-only.' : s.isOverload ? 'Remove overload status' : 'Mark as overload'}
                              disabled={togglingOverloadIds.includes(s.id) || assigning || isExternal}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${s.isOverload
                                ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                                : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30'
                              }`}
                            >
                              {togglingOverloadIds.includes(s.id) ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Saving</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>{s.isOverload ? 'Overload ON' : 'Set Overload'}</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnassign(s.id)}
                              title={isExternal ? 'Schedules from other departments are view-only.' : 'Unassign'}
                              disabled={pendingScheduleIds.includes(s.id) || assigning || isExternal}
                              className="text-red-500 hover:text-red-600 text-sm disabled:opacity-50 p-1"
                            >
                              {pendingScheduleIds.includes(s.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : '✕'}
                            </button>
                          </div>
                        </div>
                      )})
                    )}
                  </div>
                </div>

                {/* Unassigned subjects */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                  <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
                    <div className="font-semibold text-amber-800 dark:text-amber-200">Unassigned Subjects</div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">{modalFilteredUnassigned.length} available</div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-amber-100 dark:divide-amber-900/40">
                    {modalFilteredUnassigned.length === 0 ? (
                      <div className="p-4 text-sm text-amber-700 dark:text-amber-200">No unassigned subjects.</div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={modalFilteredUnassigned.length > 0 && modalFilteredUnassigned.every((s) => selectedScheduleIds.includes(s.id))}
                              onChange={toggleAllUnassigned}
                              disabled={assigning}
                            />
                            Select All
                          </label>
                          <Button size="sm" onClick={handleAssign} disabled={assigning || selectedScheduleIds.length === 0}>
                            {assigning ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Assigning...</span> : 'Assign Selected'}
                          </Button>
                        </div>
                        {modalFilteredUnassigned.map((s) => (
                          <label key={s.id} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors duration-150">
                            <input
                              type="checkbox"
                              checked={selectedScheduleIds.includes(s.id)}
                              onChange={() => toggleSchedule(s.id)}
                              disabled={assigning}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">{s.subject.code} {s.section ? `- ${s.section}` : ''}</div>
                                {s.subject.department?.name && (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                                    {s.subject.department.name}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">{s.subject.title}</div>
                              {selectedScheduleIds.includes(s.id) && facultyConflictIds.includes(s.id) && (
                                <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                                  Faculty conflict: {facultyConflictMessages[s.id] || 'Time overlap with an assigned schedule.'}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                <span>{s.subject.units} units</span>
                                <span>•</span>
                                <span>{s.dayPatternLabel || s.dayPattern || '—'}</span>
                                <span>•</span>
                                <span>{formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                                <span>•</span>
                                <span>{s.room?.code}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
        </>
      )}
    </div>
  )
}
