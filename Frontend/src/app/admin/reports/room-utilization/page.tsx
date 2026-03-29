'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import { reportsApi, schedulesApi, settingsApi } from '@/lib/admin-api'
import type { Schedule } from '@/types'

function toStandardTime(value?: string | null): string {
  if (!value) return '—'

  const trimmed = value.trim()
  if (/\b(am|pm)\b/i.test(trimmed)) return trimmed

  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  if (!match) return trimmed

  const hour24 = Number(match[1])
  const minutes = match[2]
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${minutes} ${suffix}`
}

interface RoomUtilRow {
  id: number
  code: string
  name: string | null
  type: string
  capacity: number | null
  building: string | null
  department: string | null
  college: string | null
  schedules: number
  utilization: number
}

export default function RoomUtilizationReportPage() {
  const [data, setData] = useState<RoomUtilRow[]>([])
  const [filtered, setFiltered] = useState<RoomUtilRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeSemester, setActiveSemester] = useState('')
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [collegeFilter, setCollegeFilter] = useState('all')
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null)
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null)
  const [roomSchedules, setRoomSchedules] = useState<Record<number, Schedule[]>>({})

  useEffect(() => {
    settingsApi.get()
      .then(async (settings: { activeSemester?: string; currentAcademicYear?: { id?: number } }) => {
        const sem = settings?.activeSemester || undefined
        const ayId = settings?.currentAcademicYear?.id || undefined
        if (settings?.activeSemester) setActiveSemester(settings.activeSemester)
        if (settings?.currentAcademicYear?.id) setActiveAcademicYearId(settings.currentAcademicYear.id)

        const r = await reportsApi.roomUtilization({
          limit: 500,
          ...(sem ? { semester: sem } : {}),
          ...(ayId ? { academic_year_id: ayId } : {}),
        })
        setData(r.data || [])
        setFiltered(r.data || [])
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false))
  }, [])

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(data.map((r) => r.type).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    return [{ value: 'all', label: 'All Types' }, ...types.map((t) => ({ value: t, label: t }))]
  }, [data])

  const buildingOptions = useMemo(() => {
    const buildings = Array.from(new Set(data.map((r) => r.building || 'Unassigned'))).sort((a, b) => a.localeCompare(b))
    return [{ value: 'all', label: 'All Buildings' }, ...buildings.map((b) => ({ value: b, label: b }))]
  }, [data])

  const collegeOptions = useMemo(() => {
    const colleges = Array.from(new Set(data.map((r) => r.college || 'Unassigned'))).sort((a, b) => a.localeCompare(b))
    return [{ value: 'all', label: 'All Colleges' }, ...colleges.map((c) => ({ value: c, label: c }))]
  }, [data])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(data.filter(r => {
      const matchesSearch = !q
        || r.code.toLowerCase().includes(q)
        || (r.name || '').toLowerCase().includes(q)
        || (r.type || '').toLowerCase().includes(q)
        || (r.building || '').toLowerCase().includes(q)
        || (r.department || '').toLowerCase().includes(q)
        || (r.college || '').toLowerCase().includes(q)

      const matchesType = typeFilter === 'all' || r.type === typeFilter
      const matchesBuilding = buildingFilter === 'all' || (r.building || 'Unassigned') === buildingFilter
      const matchesCollege = collegeFilter === 'all' || (r.college || 'Unassigned') === collegeFilter

      return matchesSearch && matchesType && matchesBuilding && matchesCollege
    }))
  }, [search, data, typeFilter, buildingFilter, collegeFilter])

  async function handleRowClick(room: RoomUtilRow) {
    if (expandedRoomId === room.id) {
      setExpandedRoomId(null)
      return
    }

    setExpandedRoomId(room.id)
    if (roomSchedules[room.id]) return

    setDetailsLoadingId(room.id)
    try {
      const response = await schedulesApi.list({
        limit: 500,
        room_id: room.id,
        ...(activeSemester ? { semester: activeSemester } : {}),
        ...(activeAcademicYearId ? { academic_year_id: activeAcademicYearId } : {}),
      })

      setRoomSchedules((prev) => ({
        ...prev,
        [room.id]: (response.data || []).filter((s) => s.status === 'active'),
      }))
    } finally {
      setDetailsLoadingId(null)
    }
  }

  function utilizationBadge(pct: number) {
    if (pct >= 80) return <Badge variant="success">{pct}%</Badge>
    if (pct >= 50) return <Badge variant="warning">{pct}%</Badge>
    return <Badge variant="danger">{pct}%</Badge>
  }

  const columns: Column<RoomUtilRow>[] = [
    { key: 'code', header: 'Room Code', render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.code}</span> },
    { key: 'name', header: 'Name', render: (r) => r.name || '—' },
    { key: 'type', header: 'Type', render: (r) => <Badge variant="primary">{r.type}</Badge> },
    { key: 'building', header: 'Building', render: (r) => r.building || '—' },
    { key: 'college', header: 'College', render: (r) => r.college || '—' },
    { key: 'department', header: 'Department', render: (r) => r.department || '—' },
    { key: 'capacity', header: 'Capacity', render: (r) => r.capacity ?? '—' },
    { key: 'schedules', header: 'Schedules', render: (r) => r.schedules },
    { key: 'utilization', header: 'Utilization', render: (r) => utilizationBadge(r.utilization) },
  ]

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Room Utilization Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">How efficiently rooms are being used.</p>
        </div>
        {activeSemester && <Badge variant="primary">{activeSemester} Semester</Badge>}
      </div>
      <Card>
        <CardHeader title={`${filtered.length} Rooms`} />
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search rooms..." className="max-w-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto md:min-w-[620px]">
            <Select label="College" value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)} options={collegeOptions} />
            <Select label="Building" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)} options={buildingOptions} />
            <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={typeOptions} />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.id}
          onRowClick={handleRowClick}
          expandedRowKey={expandedRoomId}
          renderExpandedRow={(room) => {
            if (detailsLoadingId === room.id) {
              return (
                <div className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-300">
                  <Spinner size="sm" />
                  Loading schedules...
                </div>
              )
            }

            const schedules = roomSchedules[room.id] || []
            if (schedules.length === 0) {
              return <p className="text-sm text-gray-500 dark:text-gray-400 py-1">No schedules found for this room in the active semester.</p>
            }

            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Room Schedules</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white dark:bg-gray-800">
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="px-3 py-2 font-medium">Subject</th>
                        <th className="px-3 py-2 font-medium">Faculty</th>
                        <th className="px-3 py-2 font-medium">Section</th>
                        <th className="px-3 py-2 font-medium">Day/Time</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {schedules.map((s) => (
                        <tr key={s.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 dark:text-white">{s.subject.code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{s.subject.title}</div>
                          </td>
                          <td className="px-3 py-2">{s.faculty?.fullName || 'Unassigned'}</td>
                          <td className="px-3 py-2">{s.section || '—'}</td>
                          <td className="px-3 py-2">{(s.dayPattern || '—')} {toStandardTime(s.startTime)} - {toStandardTime(s.endTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }}
          emptyTitle="No data"
        />
      </Card>
    </div>
  )
}
