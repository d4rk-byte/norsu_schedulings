'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { dhReportsApi, dhSettingsApi, dhSchedulesApi } from '@/lib/department-head-api'
import { useAcademicYearFilter } from '@/hooks/useAcademicYearFilter'
import type { Schedule } from '@/types'

interface FacultyWorkloadRow {
  id: number
  name: string
  employeeId: string | null
  units: number
  schedules: number
  percentage: number
  status: 'overloaded' | 'optimal' | 'underloaded'
}

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

export default function DHFacultyWorkloadReportPage() {
  const ayFilter = useAcademicYearFilter('/api/department-head')
  const [data, setData] = useState<FacultyWorkloadRow[]>([])
  const [filtered, setFiltered] = useState<FacultyWorkloadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [expandedFacultyId, setExpandedFacultyId] = useState<number | null>(null)
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null)
  const [facultySchedules, setFacultySchedules] = useState<Record<number, Schedule[]>>({})
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([])
  const [activeSemester, setActiveSemester] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'overloaded' | 'optimal' | 'underloaded'>('all')

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
        if (activeSemester) setActiveSemester(activeSemester)
      } catch {
        // Keep last known values
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

  // Load report data
  useEffect(() => {
    setLoading(true)
    setError('')
    setExpandedFacultyId(null)
    setDetailsLoadingId(null)
    setFacultySchedules({})

    const ayId = ayFilter.selectedAyId ? parseInt(ayFilter.selectedAyId) : undefined
    const sem = ayFilter.selectedSemester

    Promise.all([
      dhReportsApi.facultyWorkload({
        limit: 500,
        ...(sem ? { semester: sem } : {}),
        ...(ayId ? { academic_year_id: ayId } : {}),
      }),
      dhSchedulesApi.list({
        limit: 2000,
        ...(sem ? { semester: sem } : {}),
        ...(ayId ? { academic_year_id: ayId } : {}),
      }),
    ])
      .then(async ([workloadRes, schedRes]) => {
        // Extract faculty workload data from response
        const workloadData = workloadRes.faculty_workload || workloadRes.data || []

        // Convert to table rows
        const rows = workloadData.map((item: any) => ({
          id: item.id,
          name: item.name,
          employeeId: item.employeeId || null,
          units: item.units || 0,
          schedules: item.course_count || 0,
          percentage: Math.round(item.percentage || 0),
          status: item.status === 'overloaded' ? 'overloaded' : item.status === 'underloaded' ? 'underloaded' : 'optimal',
        }))

        setData(rows)
        setFiltered(rows)

        // Store all active schedules for expansion
        const schedules = (schedRes.data || []).filter((s: Schedule) => s.status === 'active')
        setAllSchedules(schedules)
      })
      .catch((err) => {
        console.error('Faculty workload report error:', err)
        setError('Failed to load report. Please check your filters and try again.')
      })
      .finally(() => setLoading(false))
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester])

  useEffect(() => {
    const q = search.trim().toLowerCase()

    const next = data.filter((f) => {
      const matchesSearch = !q
        || f.name.toLowerCase().includes(q)
        || (f.employeeId || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || f.status === statusFilter

      return matchesSearch && matchesStatus
    })

    setFiltered(next)
  }, [search, data, statusFilter])

  async function handleRowClick(faculty: FacultyWorkloadRow) {
    if (expandedFacultyId === faculty.id) {
      setExpandedFacultyId(null)
      return
    }

    setExpandedFacultyId(faculty.id)

    if (facultySchedules[faculty.id]) return

    setDetailsLoadingId(faculty.id)
    try {
      const schedules = allSchedules.filter((s) => s.faculty?.id === faculty.id)
      setFacultySchedules((prev) => ({ ...prev, [faculty.id]: schedules }))
    } finally {
      setDetailsLoadingId(null)
    }
  }

  function renderStatusBadge(status: FacultyWorkloadRow['status']) {
    if (status === 'overloaded') return <Badge variant="danger">Overloaded</Badge>
    if (status === 'optimal') return <Badge variant="success">Optimal</Badge>
    return <Badge variant="warning">Underloaded</Badge>
  }

  const columns: Column<FacultyWorkloadRow>[] = [
    { key: 'name', header: 'Faculty', render: (f) => <span className="font-medium text-gray-900">{f.name}</span> },
    { key: 'employeeId', header: 'Employee ID', render: (f) => f.employeeId || '—' },
    { key: 'schedules', header: 'Classes', render: (f) => f.schedules },
    { key: 'units', header: 'Units', render: (f) => f.units },
    { key: 'percentage', header: 'Load %', render: (f) => `${f.percentage}%` },
    { key: 'status', header: 'Status', render: (f) => renderStatusBadge(f.status) },
  ]

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  if (error) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faculty Workload Report</h1>
          <p className="mt-1 text-sm text-gray-500">Click a faculty row to view the subjects and schedules assigned.</p>
        </div>
        {activeSemester && <Badge variant="primary">{activeSemester} Semester</Badge>}
      </div>
      <Card>
        <CardHeader title={`${filtered.length} Faculty Members`} />
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search faculty..." className="max-w-sm" />
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'overloaded' | 'optimal' | 'underloaded')}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="overloaded">Overloaded</option>
              <option value="optimal">Optimal</option>
              <option value="underloaded">Underloaded</option>
            </select>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(f) => f.id}
          onRowClick={handleRowClick}
          expandedRowKey={expandedFacultyId}
          renderExpandedRow={(faculty) => {
            if (detailsLoadingId === faculty.id) {
              return (
                <div className="flex items-center gap-2 py-2 text-sm text-gray-600">
                  <Spinner size="sm" />
                  Loading schedules...
                </div>
              )
            }

            const schedules = facultySchedules[faculty.id] || []
            if (schedules.length === 0) {
              return <p className="text-sm text-gray-500 py-1">No assigned schedules for this faculty.</p>
            }

            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned Subjects and Schedules</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white">
                      <tr className="text-left text-gray-500 border-b">
                        <th className="px-3 py-2 font-medium">Subject</th>
                        <th className="px-3 py-2 font-medium">Section</th>
                        <th className="px-3 py-2 font-medium">Day/Time</th>
                        <th className="px-3 py-2 font-medium">Room</th>
                        <th className="px-3 py-2 font-medium">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((s) => (
                        <tr key={s.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{s.subject.code}</div>
                            <div className="text-xs text-gray-500">{s.subject.title}</div>
                          </td>
                          <td className="px-3 py-2">{s.section || '—'}</td>
                          <td className="px-3 py-2">
                            {s.dayPattern || '—'} {toStandardTime(s.startTime)} - {toStandardTime(s.endTime)}
                          </td>
                          <td className="px-3 py-2">{s.room?.code || '—'}</td>
                          <td className="px-3 py-2">{s.subject.units}</td>
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
