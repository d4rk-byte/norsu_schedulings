'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Eye, Pencil, Trash2, Building2, RefreshCw, ShieldAlert, AlertTriangle } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { formatTime } from '@/lib/utils'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { schedulesApi, departmentsApi, roomsApi } from '@/lib/admin-api'
import { SEMESTERS } from '@/lib/constants'
import type { Schedule, Department, Room, ConflictCheckResult } from '@/types'

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = { active: 'success', draft: 'warning', inactive: 'default' }

export default function DepartmentSchedulesPage() {
  const router = useRouter()
  const params = useParams()
  const departmentId = Number(params.departmentId)

  const [department, setDepartment] = useState<Department | null>(null)
  const [deptLoading, setDeptLoading] = useState(true)

  // Filter state
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedDayPattern, setSelectedDayPattern] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')

  // For stats: fetch all schedules for this department (limit 500)
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const list = useCrudList<Schedule>((p) => schedulesApi.list({ ...p, department_id: departmentId }))
    // Fetch all schedules for stats (backend defaults to the system-wide active AY/semester)
    useEffect(() => {
      setStatsLoading(true)
      schedulesApi.list({ department_id: departmentId, limit: 500, semester: selectedSemester || undefined }).then(res => {
        setAllSchedules(res.data)
        setStatsLoading(false)
      }).catch(() => setStatsLoading(false))
    }, [departmentId, selectedSemester])
    // Compute stats
    const stats = useMemo(() => {
      const filtered = allSchedules
      const total = filtered.length
      const active = filtered.filter(s => s.status === 'active').length
      const conflicts = filtered.filter(s => s.isConflicted).length
      const uniqueRooms = new Set(filtered.map(s => s.room?.id).filter(Boolean))
      const uniqueFaculty = new Set(filtered.map(s => s.faculty?.id).filter(Boolean))
      return {
        total,
        active,
        conflicts,
        rooms: uniqueRooms.size,
        faculty: uniqueFaculty.size,
      }
    }, [allSchedules])
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Fetch rooms for filter dropdown
  useEffect(() => {
    roomsApi.list({ limit: 200 }).then(res => setRooms(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    departmentsApi.get(departmentId).then(setDepartment).catch(() => {}).finally(() => setDeptLoading(false))
  }, [departmentId])

  // Sync filter params into the list's extraParams
  // AY/semester are handled by the backend's system-wide setting
  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (selectedRoom) params.room_id = selectedRoom
    if (selectedDayPattern) params.day_pattern = selectedDayPattern
    if (selectedStatus) params.status = selectedStatus
    if (selectedSemester) params.semester = selectedSemester
    list.setExtraParams(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, selectedDayPattern, selectedStatus, selectedSemester])

  async function handleDelete() {
    if (!deleteId) return
    try { await schedulesApi.delete(deleteId); list.refresh() } catch { /* */ }
    setDeleteId(null)
  }

  const [showConflicts, setShowConflicts] = useState(false)
  const conflictedSchedules = useMemo(() => allSchedules.filter(s => s.isConflicted), [allSchedules])
  const [conflictDetails, setConflictDetails] = useState<Record<number, ConflictCheckResult>>({})
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Fetch conflict details when modal opens
  useEffect(() => {
    if (!showConflicts || conflictedSchedules.length === 0) return
    setLoadingDetails(true)
    Promise.all(
      conflictedSchedules.map(s =>
        schedulesApi.checkConflict({
          roomId: s.room.id,
          dayPattern: s.dayPattern || '',
          startTime: s.startTime,
          endTime: s.endTime,
          academicYearId: s.academicYear.id,
          semester: s.semester,
          subjectId: s.subject.id,
          section: s.section || undefined,
          excludeId: s.id,
        }).then(result => ({ id: s.id, result })).catch(() => ({ id: s.id, result: null }))
      )
    ).then(results => {
      const details: Record<number, ConflictCheckResult> = {}
      results.forEach(r => { if (r.result) details[r.id] = r.result })
      setConflictDetails(details)
      setLoadingDetails(false)
    })
  }, [showConflicts, conflictedSchedules])

  const [scanning, setScanning] = useState(false)
  async function handleScanConflicts() {
    setScanning(true)
    try {
      const result = await schedulesApi.scanConflicts(departmentId)
      // Refresh data after scan
      list.refresh()
      schedulesApi.list({ department_id: departmentId, limit: 500, semester: selectedSemester || undefined }).then(res => setAllSchedules(res.data))
    } catch { /* */ }
    setScanning(false)
  }

  const columns: Column<Schedule>[] = [
    { key: 'subject', header: 'Subject', sortable: true, render: (s) => <div><span className="font-medium text-gray-900 dark:text-gray-100">{s.subject.code}</span><p className="text-xs text-gray-500 dark:text-gray-400">{s.subject.title}</p></div> },
    { key: 'faculty', header: 'Faculty', sortable: true, render: (s) => s.faculty?.fullName || '—' },
    { key: 'dayPattern', header: 'Days', sortable: true, render: (s) => s.dayPatternLabel || s.dayPattern || '—' },
    { key: 'time', header: 'Time', render: (s) => `${formatTime(s.startTime)} – ${formatTime(s.endTime)}` },
    { key: 'room', header: 'Room', render: (s) => s.room.code },
    { key: 'section', header: 'Section', render: (s) => s.section || '—' },
    {
      key: 'status', header: 'Status', sortable: true, render: (s) => (
        <div className="flex items-center gap-1">
          <Badge variant={statusVariant[s.status] || 'default'}>{s.status}</Badge>
          {s.isConflicted && <Badge variant="danger">Conflict</Badge>}
        </div>
      ),
    },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/schedules/${s.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" /></Link>
          <Link href={`/admin/schedules/${s.id}/edit`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" /></Link>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(s.id) }} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ]

  if (deptLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Department Banner */}
      <div className="bg-blue-600 dark:bg-blue-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-100 uppercase mb-1 tracking-wide">Currently Managing</div>
              <h1 className="text-2xl font-bold">{department?.name ?? 'Department'}</h1>
              <p className="text-blue-100 text-sm mt-0.5">{department?.college?.name ?? ''}</p>
            </div>
          </div>
          <Link
            href="/admin/schedules"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
          >
            <RefreshCw className="h-4 w-4" />
            Change Department
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Schedules */}
        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Schedules</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{statsLoading ? '—' : stats.total}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{department?.name}</div>
            </div>
          </div>
        </Card>
        {/* Active */}
        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Active</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{statsLoading ? '—' : stats.active}</div>
              <div className="text-xs text-green-600 mt-1 flex items-center"><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>Currently in use</div>
            </div>
          </div>
        </Card>
        {/* Conflicts */}
        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Conflicts</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{statsLoading ? '—' : stats.conflicts}</div>
              <div className={`text-xs mt-1 flex items-center ${stats.conflicts > 0 ? 'text-orange-600' : 'text-green-600'}`}>{stats.conflicts > 0 ? (<><span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1"></span>Need attention</>) : (<><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>All clear</>)}</div>
            </div>
          </div>
        </Card>
        {/* Rooms Used */}
        <Card className="flex flex-col items-start justify-between h-full" padding="lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full p-2"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Rooms Used</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{statsLoading ? '—' : stats.rooms}</div>
              <div className="text-xs text-red-600 mt-1 flex items-center"><span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span>{statsLoading ? '' : `${stats.faculty} faculty assigned`}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between mt-6">
        <Link href="/admin/schedules" className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Departments
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowConflicts(true)} disabled={statsLoading || conflictedSchedules.length === 0}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            View Conflicts {!statsLoading && conflictedSchedules.length > 0 && `(${conflictedSchedules.length})`}
          </Button>
          <Button variant="secondary" onClick={handleScanConflicts} disabled={scanning}>
            <ShieldAlert className="h-4 w-4 mr-2" />
            {scanning ? 'Scanning...' : 'Scan Conflicts'}
          </Button>
          <Link href={`/admin/schedules/create?department=${departmentId}${selectedSemester ? `&semester=${selectedSemester}` : ''}`}>
            <Button><Plus className="h-4 w-4 mr-2" />Create Schedule</Button>
          </Link>
        </div>
      </div>

      {/* Schedules Table */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search subject, faculty, room..." className="flex-1 min-w-[200px] max-w-md text-sm" />
          <div className="flex items-center gap-3 flex-wrap ml-auto">
            <div className="w-40 shrink-0">
              <Select
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}
                placeholder="All Semesters"
                options={SEMESTERS.map(s => ({ value: s, label: s === '1st' ? '1st Semester' : s === '2nd' ? '2nd Semester' : 'Summer' }))}
                className="text-sm py-2"
              />
            </div>
            <div className="w-44 shrink-0">
              <Select
                value={selectedRoom}
                onChange={e => setSelectedRoom(e.target.value)}
                placeholder="All Rooms"
                options={rooms.map(r => ({ value: String(r.id), label: r.code }))}
                className="text-sm py-2"
              />
            </div>
            <div className="w-36 shrink-0">
              <Select
                value={selectedDayPattern}
                onChange={e => setSelectedDayPattern(e.target.value)}
                placeholder="All Days"
                options={[
                  { value: 'M-W-F', label: 'M-W-F' },
                  { value: 'T-TH', label: 'T-TH' },
                  { value: 'M-T-TH-F', label: 'M-T-TH-F' },
                  { value: 'M-T', label: 'M-T' },
                  { value: 'TH-F', label: 'TH-F' },
                  { value: 'SAT', label: 'SAT' },
                ]}
                className="text-sm py-2"
              />
            </div>
            <div className="w-36 shrink-0">
              <Select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                placeholder="Status"
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'active', label: 'Active' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                className="text-sm py-2"
              />
            </div>
            {(selectedRoom || selectedDayPattern || selectedStatus || selectedSemester) && (
              <button
                onClick={() => { setSelectedRoom(''); setSelectedDayPattern(''); setSelectedStatus(''); setSelectedSemester('') }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 whitespace-nowrap transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(s) => s.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(s) => router.push(`/admin/schedules/${s.id}?fromDepartment=${departmentId}`)} emptyTitle="No schedules found for this department" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Schedule" confirmLabel="Delete" variant="danger" message="Are you sure you want to delete this schedule?" />

      {/* View Conflicts Modal */}
      <Modal open={showConflicts} onClose={() => setShowConflicts(false)} title={`Conflicted Schedules (${conflictedSchedules.length})`} size="xl">
        {conflictedSchedules.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No conflicted schedules found.</p>
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {conflictedSchedules.map(s => {
              const details = conflictDetails[s.id]
              const types = details ? [...new Set(details.conflicts.map(c => c.type))] : []
              return (
                <div key={s.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 dark:text-gray-100">{s.subject.code}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">—</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{s.subject.title}</span>
                        {s.section && <Badge variant="default">Section {s.section}</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">Room:</span> {s.room.code}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">Days:</span> {s.dayPatternLabel || s.dayPattern || '—'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">Time:</span> {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">Faculty:</span> {s.faculty?.fullName || '—'}
                        </span>
                      </div>
                      {/* Conflict type badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {loadingDetails && !details && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Loading conflict details...</span>
                        )}
                        {types.includes('room_time_conflict') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            🏫 Room Conflict
                          </span>
                        )}
                        {types.includes('faculty_conflict') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            👤 Faculty Conflict
                          </span>
                        )}
                        {types.includes('section_conflict') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                            📋 Section Conflict
                          </span>
                        )}
                        {details && details.conflicts.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            — conflicts with {details.conflicts.length} schedule{details.conflicts.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/admin/schedules/${s.id}/edit`} onClick={() => setShowConflicts(false)}>
                      <Button size="sm" variant="secondary">
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    </Link>
                  </div>
                  {/* Conflicting schedule details */}
                  {details && details.conflicts.length > 0 && (
                    <div className="mt-3 border-t border-red-200 dark:border-red-800 pt-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conflicts with:</p>
                      {details.conflicts.map((c, ci) => (
                        <div key={ci} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-red-100 dark:border-red-800 rounded px-3 py-2 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{c.schedule?.subject.code || '—'}</span>
                            <span className="text-gray-500 dark:text-gray-400">Section {c.schedule?.section || '—'}</span>
                            <span className="text-gray-500 dark:text-gray-400">{c.schedule?.room.code}</span>
                            <span className="text-gray-500 dark:text-gray-400">{c.schedule?.dayPattern} {c.schedule?.startTime ? formatTime(c.schedule.startTime) : ''}–{c.schedule?.endTime ? formatTime(c.schedule.endTime) : ''}</span>
                            {c.type === 'room_time_conflict' && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Room</span>}
                            {c.type === 'faculty_conflict' && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">Faculty</span>}
                            {c.type === 'section_conflict' && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">Section</span>}
                          </div>
                          {c.schedule && (
                            <Link href={`/admin/schedules/${c.schedule.id}/edit`} onClick={() => setShowConflicts(false)} className="text-blue-600 hover:text-blue-800 font-medium">
                              Edit
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
