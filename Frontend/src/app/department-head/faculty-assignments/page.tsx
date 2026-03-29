'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Eye, Plus, AlertTriangle, FileDown, Search } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAcademicYearFilter } from '@/hooks/useAcademicYearFilter'
import { dhFacultyAssignmentsApi, dhSettingsApi, dhDepartmentInfo, dhSchedulesApi, dhReportsApi } from '@/lib/department-head-api'
import { formatTime } from '@/lib/utils'
import type { FacultyAssignment } from '@/lib/department-head-api'
import type { Department, Schedule } from '@/types'

interface FacultyLoadRow {
  id: number
  fullName: string
  employeeId: string | null
  position: string | null
  department: { id: number; code: string; name: string } | null
  assignedCount: number
  totalUnits: number
  totalHours: number
}

export default function DHFacultyAssignmentsPage() {
  const ayFilter = useAcademicYearFilter('/api/department-head')
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [department, setDepartment] = useState<Department | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [summary, setSummary] = useState({ totalSchedules: 0, assignedSchedules: 0, unassignedSchedules: 0 })

  const [showViewModal, setShowViewModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyLoadRow | null>(null)
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

  // Sync system period
  useEffect(() => {
    let active = true

    async function syncSystemPeriod() {
      try {
        const settings = await dhSettingsApi.get()
        if (!active) return

        const currentAy = settings.currentAcademicYear as { id?: number } | null | undefined
        const activeSemester = typeof settings.activeSemester === 'string' ? settings.activeSemester : ''

        ayFilter.setSelectedAyId(currentAy?.id ? String(currentAy.id) : '')
        ayFilter.setSelectedSemester(activeSemester)
      } catch {
        // Keep last known values if settings fetch fails.
      }
    }

    syncSystemPeriod()
    const timer = setInterval(syncSystemPeriod, 15000)

    return () => {
      active = false
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Get department info
  useEffect(() => {
    dhDepartmentInfo.get()
      .then(setDepartment)
      .catch(() => setError('Failed to load department info'))
  }, [])

  // Load faculty assignments and summary
  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      dhFacultyAssignmentsApi.list({
        academic_year_id: ayFilter.selectedAyId || undefined,
        semester: ayFilter.selectedSemester || undefined,
      }),
      dhSchedulesApi.list({
        academic_year_id: ayFilter.selectedAyId || undefined,
        semester: ayFilter.selectedSemester || undefined,
        limit: 2000,
      }),
    ])
      .then(([assignRes, schedRes]: any) => {
        const assigns = assignRes.data || assignRes
        setAssignments(assigns)

        const allSchedules = schedRes.data || []
        const assigned = allSchedules.filter((s: Schedule) => s.faculty)
        const unassigned = allSchedules.filter((s: Schedule) => !s.faculty)
        setSummary({
          totalSchedules: allSchedules.length,
          assignedSchedules: assigned.length,
          unassignedSchedules: unassigned.length,
        })
      })
      .catch(() => {
        setError('Failed to load faculty assignments')
        setSummary({ totalSchedules: 0, assignedSchedules: 0, unassignedSchedules: 0 })
      })
      .finally(() => setLoading(false))
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester])

  // Convert assignments to table rows
  const tableData: FacultyLoadRow[] = assignments.map(a => ({
    id: a.faculty.id,
    fullName: a.faculty.fullName,
    employeeId: a.faculty.employeeId,
    position: a.faculty.position,
    department: a.faculty.department || null,
    assignedCount: a.schedules.length,
    totalUnits: a.totalUnits,
    totalHours: a.totalHours,
  }))

  // Filter table data
  const filteredData = tableData.filter(f =>
    f.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (f.department?.code.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (f.department?.name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  // Load faculty schedules for modal
  async function loadFacultySchedules(faculty: FacultyLoadRow) {
    setLoadingAssignments(true)
    setActionMessage('')
    setSelectedScheduleIds([])
    setPendingScheduleIds([])
    setFacultyConflictIds([])
    setFacultyConflictMessages({})
    try {
      const departmentId = department?.id ?? 0
      const res = await dhSchedulesApi.list({
        academic_year_id: ayFilter.selectedAyId || undefined,
        semester: ayFilter.selectedSemester || undefined,
        include_group: true,
        limit: 2000,
      })
      const allSchedules = res.data || []
      const loaded = allSchedules.filter((s: Schedule) => s.faculty?.id === faculty.id)
      const unassigned = departmentId
        ? allSchedules.filter((s: Schedule) => !s.faculty && s.subject.department?.id === departmentId)
        : []
      setLoadedSchedules(loaded)
      setUnassignedSchedules(unassigned)
    } catch {
      setLoadedSchedules([])
      setUnassignedSchedules([])
    }
    setLoadingAssignments(false)
  }

  function openViewSchedules(faculty: FacultyLoadRow) {
    setSelectedFaculty(faculty)
    setModalScheduleSearch('')
    setActionMessage('')
    setShowViewModal(true)
    loadFacultySchedules(faculty)
  }

  function openAssignSchedules(faculty: FacultyLoadRow) {
    setSelectedFaculty(faculty)
    setModalScheduleSearch('')
    setActionMessage('')
    setShowAssignModal(true)
    loadFacultySchedules(faculty)
  }

  async function viewTeachingLoadPdf() {
    if (!selectedFaculty) return

    setDownloadingPdf(true)
    try {
      const blob = await dhReportsApi.teachingLoadPdf(selectedFaculty.id)
      const url = window.URL.createObjectURL(blob)
      const previewWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!previewWindow) {
        setActionMessage('Popup blocked. Please allow popups to preview the PDF.')
      }
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

    const assignIds = selectedScheduleIds
    const selectedSchedules = unassignedSchedules.filter((s) => assignIds.includes(s.id))
    setActionMessage('Checking faculty conflicts...')

    const checks = await Promise.all(selectedSchedules.map(async (s) => {
      try {
        const result = await dhSchedulesApi.checkConflict({
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
        safeAssignIds.map((id) => dhSchedulesApi.assignFaculty(id, { facultyId: selectedFaculty.id }))
      )
      await loadFacultySchedules(selectedFaculty)
      // Reload main list
      const res = await dhFacultyAssignmentsApi.list({
        academic_year_id: ayFilter.selectedAyId || undefined,
        semester: ayFilter.selectedSemester || undefined,
      })
      setAssignments(res.data || res)
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
    if (!selectedFaculty || pendingScheduleIds.includes(id)) return

    const target = loadedSchedules.find((s) => s.id === id)
    if (!target) return

    const departmentId = department?.id ?? 0
    const targetDepartmentId = target.subject.department?.id ?? 0
    if (!departmentId || targetDepartmentId !== departmentId) {
      setActionMessage('You can only modify schedules from your department.')
      return
    }

    setPendingScheduleIds((prev) => [...prev, id])

    setLoadedSchedules((prev) => prev.filter((s) => s.id !== id))
    setUnassignedSchedules((prev) => [target, ...prev])
    setSummary((prev) => ({
      ...prev,
      assignedSchedules: Math.max(0, prev.assignedSchedules - 1),
      unassignedSchedules: prev.unassignedSchedules + 1,
    }))

    try {
      await dhSchedulesApi.assignFaculty(id, { facultyId: null })
      // Reload main list
      const res = await dhFacultyAssignmentsApi.list({
        academic_year_id: ayFilter.selectedAyId || undefined,
        semester: ayFilter.selectedSemester || undefined,
      })
      setAssignments(res.data || res)
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

    const departmentId = department?.id ?? 0
    const scheduleDepartmentId = current.subject.department?.id ?? 0
    if (!departmentId || scheduleDepartmentId !== departmentId) {
      setActionMessage('You can only modify schedules from your department.')
      return
    }

    const nextValue = !current.isOverload
    setTogglingOverloadIds((prev) => [...prev, id])

    setLoadedSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, isOverload: nextValue } : s)))

    try {
      const result = await dhSchedulesApi.toggleOverload(id)
      setLoadedSchedules((prev) => prev.map((s) => (
        s.id === id ? { ...s, isOverload: result.isOverload } : s
      )))
    } catch {
      setLoadedSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, isOverload: current.isOverload } : s)))
      setActionMessage('Could not update overload status. Please try again.')
    }

    setTogglingOverloadIds((prev) => prev.filter((x) => x !== id))
  }

  // Filtered schedules for modal
  const modalFilteredLoaded = useMemo(() => {
    const q = modalScheduleSearch.trim().toLowerCase()
    if (!q) return loadedSchedules
    return loadedSchedules.filter((s) =>
      s.subject.code.toLowerCase().includes(q)
      || s.subject.title.toLowerCase().includes(q)
      || (s.section || '').toLowerCase().includes(q)
      || (s.room?.code || '').toLowerCase().includes(q)
    )
  }, [loadedSchedules, modalScheduleSearch])

  const modalFilteredUnassigned = useMemo(() => {
    const q = modalScheduleSearch.trim().toLowerCase()
    if (!q) return unassignedSchedules
    return unassignedSchedules.filter((s) =>
      s.subject.code.toLowerCase().includes(q)
      || s.subject.title.toLowerCase().includes(q)
      || (s.section || '').toLowerCase().includes(q)
      || (s.room?.code || '').toLowerCase().includes(q)
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

  const selectedDepartmentId = department?.id ?? 0

  // Table columns
  const columns: Column<FacultyLoadRow>[] = [
    { key: 'fullName', header: 'Faculty', sortable: true, render: (f) => <div><span className="font-medium text-gray-900 dark:text-white">{f.fullName}</span></div> },
    { key: 'employeeId', header: 'Employee ID', sortable: true, render: (f) => f.employeeId || 'N/A' },
    { key: 'position', header: 'Position', sortable: true, render: (f) => f.position || 'N/A' },
    {
      key: 'department',
      header: 'Department',
      render: (f) => f.department ? (
        <Badge variant="secondary" title={f.department.name}>{f.department.code}</Badge>
      ) : 'N/A'
    },
    { key: 'assignedCount', header: 'Assigned', sortable: true, render: (f) => <Badge variant="primary">{f.assignedCount}</Badge> },
    { key: 'totalUnits', header: 'Units', sortable: true, render: (f) => f.totalUnits },
    { key: 'totalHours', header: 'Hours/Week', sortable: true, render: (f) => <span className={f.totalHours > 24 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{f.totalHours}</span> },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openViewSchedules(f)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="View schedules"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openAssignSchedules(f)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
            title="Assign schedules"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Faculty Loading</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{department?.name}</p>
      </div>

      {/* Department Info */}
      <Card>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Department</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{department?.name || '—'}</p>
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Schedules</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{summary.totalSchedules}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Assigned</div>
          <div className="text-3xl font-bold text-green-600">{summary.assignedSchedules}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Unassigned</div>
          <div className="text-3xl font-bold text-amber-600">{summary.unassignedSchedules}</div>
        </Card>
      </div>

      {/* Faculty Load Summary Table */}
      <Card>
        <CardHeader title="Faculty Load Summary" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search faculty..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filteredData} keyExtractor={(f) => f.id} loading={false} emptyTitle="No faculty data" />
      </Card>

      {/* View Modal */}
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
          <div className="text-sm text-gray-500 dark:text-gray-400">Select a faculty member to view schedules.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Current Load</div>
                <div className="font-semibold text-gray-900 dark:text-white">{liveLoad.count} schedules • {liveLoad.units} units • {liveLoad.hours} hrs/week</div>
              </div>
              <Button onClick={viewTeachingLoadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Opening PDF...</span> : <span className="inline-flex items-center gap-2"><FileDown className="h-4 w-4" />View Teaching Load PDF</span>}
              </Button>
            </div>

            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={modalScheduleSearch}
                onChange={(e) => setModalScheduleSearch(e.target.value)}
                placeholder="Search schedules..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {loadingAssignments ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading schedules...</div>
            ) : modalFilteredLoaded.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No assigned schedules found.</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40">
                {modalFilteredLoaded.map((s) => (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-gray-900 dark:text-white">{s.subject.code} {s.section ? `- ${s.section}` : ''}</div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{s.subject.title}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                      <span>{s.subject.units} units</span>
                      <span>•</span>
                      <span>{s.dayPatternLabel || s.dayPattern || '—'}</span>
                      <span>•</span>
                      <span>{formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                      <span>•</span>
                      <span>{s.room?.code || 'No room'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Assign Modal */}
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
          <div className="text-sm text-gray-500 dark:text-gray-400">Select a faculty member to assign schedules.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Employee ID</div>
                <div className="font-medium text-gray-900 dark:text-white">{selectedFaculty.employeeId || 'N/A'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Current Load</div>
                <div className="font-semibold text-gray-900 dark:text-white">{liveLoad.count} schedules • {liveLoad.units} units • {liveLoad.hours} hrs/week</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={modalScheduleSearch}
                  onChange={(e) => setModalScheduleSearch(e.target.value)}
                  placeholder="Search loaded or unassigned schedules..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              {actionMessage && <div className="text-xs text-gray-500 dark:text-gray-400">{actionMessage}</div>}
            </div>

            {loadingAssignments ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading schedules...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Loaded subjects */}
                <div className="rounded-xl border border-green-200 dark:border-green-500/40 bg-green-50 dark:bg-green-500/12">
                  <div className="px-4 py-3 border-b border-green-200 dark:border-green-500/40 flex items-center justify-between">
                    <div className="font-semibold text-green-800 dark:text-green-300">Loaded Subjects</div>
                    <div className="text-xs text-green-700 dark:text-green-300">{modalFilteredLoaded.length} subjects</div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-green-100 dark:divide-green-500/30">
                    {modalFilteredLoaded.length === 0 ? (
                      <div className="p-4 text-sm text-green-700 dark:text-green-300">No loaded subjects.</div>
                    ) : (
                      modalFilteredLoaded.map((s) => {
                        const scheduleDepartmentId = s.subject.department?.id ?? 0
                        const isExternal = selectedDepartmentId > 0 && scheduleDepartmentId !== selectedDepartmentId

                        return (
                        <div key={s.id} className={`p-4 flex items-start justify-between gap-3 transition-colors duration-150 ${s.isOverload ? 'bg-amber-50/70 dark:bg-amber-500/15' : ''}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold text-gray-900 dark:text-white">{s.subject.code} {s.section ? `- ${s.section}` : ''}</div>
                              {isExternal && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                                  View only
                                </span>
                              )}
                              {s.isOverload && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                                  OVERLOAD
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">{s.subject.title}</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
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
                                : 'bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/15'
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
                              className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm disabled:opacity-50 p-1"
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
                <div className="rounded-xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/12">
                  <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-500/40 flex items-center justify-between">
                    <div className="font-semibold text-amber-800 dark:text-amber-300">Unassigned Subjects</div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">{modalFilteredUnassigned.length} available</div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-amber-100 dark:divide-amber-500/30">
                    {modalFilteredUnassigned.length === 0 ? (
                      <div className="p-4 text-sm text-amber-700 dark:text-amber-300">No unassigned subjects.</div>
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
                          <label key={s.id} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors duration-150">
                            <input
                              type="checkbox"
                              checked={selectedScheduleIds.includes(s.id)}
                              onChange={() => toggleSchedule(s.id)}
                              disabled={assigning}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold text-gray-900 dark:text-white">{s.subject.code} {s.section ? `- ${s.section}` : ''}</div>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">{s.subject.title}</div>
                              {selectedScheduleIds.includes(s.id) && facultyConflictIds.includes(s.id) && (
                                <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                                  Faculty conflict: {facultyConflictMessages[s.id] || 'Time overlap with an assigned schedule.'}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
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
    </div>
  )
}
