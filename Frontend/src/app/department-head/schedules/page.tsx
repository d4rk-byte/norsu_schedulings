'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Edit, Building2, AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { formatTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { useAcademicYearFilter } from '@/hooks/useAcademicYearFilter'
import { DAY_PATTERNS } from '@/lib/constants'
import { dhDepartmentInfo, dhLookupsApi, dhSchedulesApi } from '@/lib/department-head-api'
import type { ConflictCheckResult, Schedule } from '@/types'

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  draft: 'warning',
  inactive: 'default',
}

export default function DHSchedulesListPage() {
  const router = useRouter()
  const ayFilter = useAcademicYearFilter('/api/department-head')
  const list = useCrudList<Schedule>((p) => dhSchedulesApi.list(p))

  const [departmentName, setDepartmentName] = useState('Department')
  const [collegeName, setCollegeName] = useState('')
  const [rooms, setRooms] = useState<Array<{ id: number; code: string }>>([])

  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedDayPattern, setSelectedDayPattern] = useState('')

  const [allSchedules, setAllSchedules] = useState<Schedule[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [hasLoadedStats, setHasLoadedStats] = useState(false)
  const [hasLoadedList, setHasLoadedList] = useState(false)

  const [headerLoading, setHeaderLoading] = useState(true)
  const [roomsLoading, setRoomsLoading] = useState(true)

  const [showConflicts, setShowConflicts] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<Record<number, ConflictCheckResult>>({})
  const [loadingConflictDetails, setLoadingConflictDetails] = useState(false)

  useEffect(() => {
    list.setExtraParams({
      ...ayFilter.filterParams,
      room_id: selectedRoom || undefined,
      day_pattern: selectedDayPattern || undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester, selectedRoom, selectedDayPattern])

  useEffect(() => {
    let active = true

    setHeaderLoading(true)
    setRoomsLoading(true)

    dhDepartmentInfo
      .get()
      .then((dept) => {
        if (!active) return
        setDepartmentName(dept.name || 'Department')
        setCollegeName(dept.college?.name || '')
      })
      .catch(() => {})
      .finally(() => {
        if (!active) return
        setHeaderLoading(false)
      })

    dhLookupsApi
      .rooms()
      .then((res) => {
        if (!active) return
        setRooms(res.data.map((r) => ({ id: r.id, code: r.code })))
      })
      .catch(() => {
        if (!active) return
        setRooms([])
      })
      .finally(() => {
        if (!active) return
        setRoomsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    setStatsLoading(true)
    dhSchedulesApi
      .list({
        limit: 500,
        academic_year_id: ayFilter.selectedAyId || undefined,
        semester: ayFilter.selectedSemester || undefined,
        room_id: selectedRoom || undefined,
        day_pattern: selectedDayPattern || undefined,
      })
      .then((res) => {
        if (!active) return
        setAllSchedules(res.data)
      })
      .catch(() => {
        if (!active) return
        setAllSchedules([])
      })
      .finally(() => {
        if (!active) return
        setStatsLoading(false)
        setHasLoadedStats(true)
      })

    return () => {
      active = false
    }
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester, selectedRoom, selectedDayPattern])

  const stats = useMemo(() => {
    const total = allSchedules.length
    const active = allSchedules.filter((s) => s.status === 'active').length
    const conflicts = allSchedules.filter((s) => s.isConflicted).length
    const uniqueRooms = new Set(allSchedules.map((s) => s.room?.id).filter(Boolean))
    const uniqueFaculty = new Set(allSchedules.map((s) => s.faculty?.id).filter(Boolean))

    return {
      total,
      active,
      conflicts,
      rooms: uniqueRooms.size,
      faculty: uniqueFaculty.size,
    }
  }, [allSchedules])

  const conflictedSchedules = useMemo(() => allSchedules.filter((s) => s.isConflicted), [allSchedules])

  const conflictTypeSummary = useMemo(() => {
    let room = 0
    let faculty = 0
    let section = 0

    Object.values(conflictDetails).forEach((detail) => {
      detail.conflicts.forEach((c) => {
        if (c.type === 'room_time_conflict') room += 1
        if (c.type === 'faculty_conflict') faculty += 1
        if (c.type === 'section_conflict') section += 1
      })
    })

    return { room, faculty, section }
  }, [conflictDetails])

  useEffect(() => {
    if (!showConflicts || conflictedSchedules.length === 0) return

    let active = true

    setLoadingConflictDetails(true)
    Promise.all(
      conflictedSchedules.map((s) =>
        dhSchedulesApi
          .checkConflict({
            roomId: s.room.id,
            dayPattern: s.dayPattern || '',
            startTime: s.startTime,
            endTime: s.endTime,
            academicYearId: s.academicYear.id,
            semester: s.semester,
            subjectId: s.subject.id,
            section: s.section || undefined,
            excludeId: s.id,
          })
          .then((result) => ({ id: s.id, result }))
          .catch(() => ({ id: s.id, result: null })),
      ),
    )
      .then((results) => {
        if (!active) return
        const next: Record<number, ConflictCheckResult> = {}
        results.forEach((r) => {
          if (r.result) next[r.id] = r.result
        })
        setConflictDetails(next)
      })
      .finally(() => {
        if (!active) return
        setLoadingConflictDetails(false)
      })

    return () => {
      active = false
    }
  }, [showConflicts, conflictedSchedules])

  useEffect(() => {
    if (!showConflicts) {
      setConflictDetails({})
    }
  }, [showConflicts])

  useEffect(() => {
    if (!list.loading) {
      setHasLoadedList(true)
    }
  }, [list.loading])

  const showInitialDashboardLoading = !hasLoadedStats || !hasLoadedList
  const showStatsSkeleton = statsLoading && showInitialDashboardLoading
  const statsRefreshing = !showInitialDashboardLoading && statsLoading
  const listRefreshing = !showInitialDashboardLoading && list.loading
  const hasActiveFilters = Boolean(selectedRoom || selectedDayPattern || ayFilter.selectedSemester)

  const columns: Column<Schedule>[] = [
    {
      key: 'subject',
      header: 'Subject',
      sortable: true,
      render: (s) => (
      <div>
        <span className="font-medium text-gray-900">{s.subject.code}</span>
        <span className="text-xs text-gray-400 ml-2">{s.subject.title}</span>
      </div>
      ),
    },
    { key: 'faculty', header: 'Faculty', render: (s) => s.faculty?.fullName || <span className="text-gray-400 italic">Unassigned</span> },
    { key: 'room', header: 'Room', render: (s) => s.room.code },
    { key: 'dayPattern', header: 'Days', render: (s) => s.dayPatternLabel || s.dayPattern },
    { key: 'startTime', header: 'Time', render: (s) => `${formatTime(s.startTime)} – ${formatTime(s.endTime)}` },
    { key: 'section', header: 'Section', render: (s) => s.section || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Badge variant={statusVariant[s.status] || 'default'}>{s.status}</Badge>
          {s.isConflicted && <Badge variant="danger">Conflict</Badge>}
        </div>
      ),
    },
    { key: 'actions', header: '', render: (s) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); router.push(`/department-head/schedules/${s.id}`) }} className="p-1.5 rounded hover:bg-gray-100"><Eye className="h-4 w-4 text-gray-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); router.push(`/department-head/schedules/${s.id}/edit`) }} className="p-1.5 rounded hover:bg-gray-100"><Edit className="h-4 w-4 text-gray-500" /></button>
      </div>
    )},
  ]

  const roomOptions = rooms.map((r) => ({ value: String(r.id), label: r.code }))
  const dayOptions = DAY_PATTERNS.map((d) => ({ value: d.value, label: d.label }))

  function clearFilters() {
    setSelectedRoom('')
    setSelectedDayPattern('')
    ayFilter.setSelectedSemester('')
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="bg-blue-600 dark:bg-blue-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-blue-100 uppercase mb-1 tracking-wide">Currently Managing</div>
              <h1 className="text-2xl font-bold min-h-8 flex items-center">
                {headerLoading ? (
                  <span className="h-7 w-56 rounded bg-white/25 animate-pulse" aria-hidden="true" />
                ) : (
                  departmentName
                )}
              </h1>
              <p className="text-blue-100 text-sm mt-0.5 min-h-5 flex items-center">
                {headerLoading ? (
                  <span className="h-4 w-40 rounded bg-white/20 animate-pulse" aria-hidden="true" />
                ) : (
                  collegeName
                )}
              </p>
            </div>
          </div>
          <Link href="/department-head/schedules/create">
            <Button
              size="sm"
              className="bg-white/20 border border-white/30 text-white hover:bg-white/30 shadow-none"
              icon={<Plus className="h-4 w-4" />}
            >
              Create Schedule
            </Button>
          </Link>
        </div>
      </div>

      {list.error && <Alert variant="error">{list.error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 text-blue-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Schedules</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 min-h-9 min-w-16 flex items-center tabular-nums">
                {showStatsSkeleton ? (
                  <span className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true" />
                ) : (
                  stats.total
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 text-green-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Active</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 min-h-9 min-w-16 flex items-center tabular-nums">
                {showStatsSkeleton ? (
                  <span className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true" />
                ) : (
                  stats.active
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 text-orange-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Conflicts</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 min-h-9 min-w-16 flex items-center tabular-nums">
                {showStatsSkeleton ? (
                  <span className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true" />
                ) : (
                  stats.conflicts
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-100 text-red-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Rooms Used</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 min-h-9 min-w-16 flex items-center tabular-nums">
                {showStatsSkeleton ? (
                  <span className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true" />
                ) : (
                  stats.rooms
                )}
              </div>
              <div className="text-xs text-red-600 mt-1 min-h-4 flex items-center tabular-nums">
                {showStatsSkeleton ? (
                  <span className="h-3 w-24 rounded bg-red-100/70 dark:bg-red-900/40 animate-pulse" aria-hidden="true" />
                ) : (
                  `${stats.faculty} faculty assigned`
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Schedule List</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 inline-flex flex-wrap items-center gap-2 min-h-5">
              <span>Filtered to your department only</span>
              <span className="inline-flex items-center min-w-28 text-blue-600 dark:text-blue-400 text-xs font-medium">
                {statsRefreshing || listRefreshing ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating metrics...
                  </span>
                ) : null}
              </span>
            </p>
          </div>
          <Button size="sm" variant="secondary" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => setShowConflicts(true)} disabled={showInitialDashboardLoading || conflictedSchedules.length === 0} className="w-full justify-center sm:w-auto sm:justify-center">
            <span className="inline-flex items-center gap-1">
              <span>View Conflicts</span>
              <span className={`inline-flex min-w-10 justify-center tabular-nums ${(showInitialDashboardLoading || conflictedSchedules.length === 0) ? 'opacity-0' : ''}`}>
                ({conflictedSchedules.length})
              </span>
            </span>
          </Button>
        </div>

        <Card>
          <div className="mb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
              <div className="sm:col-span-2 xl:col-span-4">
                <SearchBar
                  value={list.search}
                  onChange={list.setSearch}
                  placeholder="Search subject, faculty, room..."
                  className="w-full text-sm"
                />
              </div>

              <div className="xl:col-span-2">
                <Select value={ayFilter.selectedAyId} onChange={e => ayFilter.setSelectedAyId(e.target.value)} options={ayFilter.ayOptions} className="text-sm py-2" disabled={ayFilter.loading} />
              </div>
              <div className="xl:col-span-2">
                <Select value={ayFilter.selectedSemester} onChange={e => ayFilter.setSelectedSemester(e.target.value)} options={ayFilter.semesterOptions} className="text-sm py-2" disabled={ayFilter.loading} />
              </div>
              <div className="xl:col-span-2">
                <Select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} placeholder={roomsLoading ? 'Loading rooms...' : 'All Rooms'} options={roomOptions} className="text-sm py-2" disabled={roomsLoading} />
              </div>
              <div className="xl:col-span-2">
                <Select value={selectedDayPattern} onChange={e => setSelectedDayPattern(e.target.value)} placeholder="All Days" options={dayOptions} className="text-sm py-2" />
              </div>

              <div className="flex items-end sm:col-span-2 xl:col-span-12 xl:justify-end">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className={`h-[42px] px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700 transition whitespace-nowrap ${hasActiveFilters ? '' : 'invisible pointer-events-none'}`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
          <div className="min-h-96">
            <DataTable columns={columns} data={list.data} keyExtractor={(s) => s.id} loading={list.loading || showInitialDashboardLoading} sort={list.sort} onSort={list.setSort} onRowClick={(s) => router.push(`/department-head/schedules/${s.id}`)} emptyTitle="No schedules found for your department" />
          </div>
          <div className="mt-4 min-h-10">
            <Pagination currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
          </div>
        </Card>
      </div>

      <Modal open={showConflicts} onClose={() => setShowConflicts(false)} title={`Conflicted Schedules (${conflictedSchedules.length})`} size="xl">
        {conflictedSchedules.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No conflicted schedules found.</p>
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Summary:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  Room <span className="inline-flex min-w-8 justify-end tabular-nums">{loadingConflictDetails ? '...' : conflictTypeSummary.room}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                  Faculty <span className="inline-flex min-w-8 justify-end tabular-nums">{loadingConflictDetails ? '...' : conflictTypeSummary.faculty}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                  Section <span className="inline-flex min-w-8 justify-end tabular-nums">{loadingConflictDetails ? '...' : conflictTypeSummary.section}</span>
                </span>
              </div>
            </div>

            {conflictedSchedules.map((s) => (
              <div key={s.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="min-h-5 mb-2">
                      {loadingConflictDetails && !conflictDetails[s.id] && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading conflict details...
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{s.subject.code}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">—</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{s.subject.title}</span>
                      {s.section && <Badge variant="default">Section {s.section}</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                      <span><span className="font-medium">Room:</span> {s.room.code}</span>
                      <span><span className="font-medium">Days:</span> {s.dayPatternLabel || s.dayPattern || '—'}</span>
                      <span><span className="font-medium">Time:</span> {formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                      <span><span className="font-medium">Faculty:</span> {s.faculty?.fullName || '—'}</span>
                    </div>

                    {conflictDetails[s.id] && conflictDetails[s.id].conflicts.length > 0 && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {[...new Set(conflictDetails[s.id].conflicts.map((c) => c.type))].includes('room_time_conflict') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Room Conflict</span>
                          )}
                          {[...new Set(conflictDetails[s.id].conflicts.map((c) => c.type))].includes('faculty_conflict') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Faculty Conflict</span>
                          )}
                          {[...new Set(conflictDetails[s.id].conflicts.map((c) => c.type))].includes('section_conflict') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Section Conflict</span>
                          )}
                        </div>

                        <div className="mt-3 border-t border-red-200 dark:border-red-800 pt-3 space-y-2">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conflicts with:</p>
                          {conflictDetails[s.id].conflicts.map((c, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-red-100 dark:border-red-800 rounded px-3 py-2 text-xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-bold text-gray-900 dark:text-gray-100">{c.schedule?.subject.code || '—'}</span>
                                <span className="text-gray-500 dark:text-gray-400">Section {c.schedule?.section || '—'}</span>
                                <span className="text-gray-500 dark:text-gray-400">{c.schedule?.room.code || '—'}</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                  {c.schedule?.dayPattern || '—'} {c.schedule?.startTime ? formatTime(c.schedule.startTime) : ''}
                                  {c.schedule?.startTime && c.schedule?.endTime ? ' – ' : ''}
                                  {c.schedule?.endTime ? formatTime(c.schedule.endTime) : ''}
                                </span>
                              </div>
                              {c.schedule?.id && (
                                <Link href={`/department-head/schedules/${c.schedule.id}/edit`} onClick={() => setShowConflicts(false)} className="text-blue-600 hover:text-blue-800 font-medium">
                                  Edit
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <Link href={`/department-head/schedules/${s.id}/edit`} onClick={() => setShowConflicts(false)}>
                    <Button size="sm" variant="secondary">Edit</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
