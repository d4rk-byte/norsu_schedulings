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

interface FacultyWorkloadRow {
  id: number
  name: string
  employeeId: string | null
  college: string | null
  department: string | null
  units: number
  schedules: number
  percentage: number
  status: 'overloaded' | 'optimal' | 'underloaded'
}

export default function FacultyWorkloadReportPage() {
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
  const [collegeFilter, setCollegeFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      settingsApi.get(),
    ])
      .then(async ([settings]: [{ activeSemester?: string; currentAcademicYear?: { id?: number } }]) => {
        const sem = settings?.activeSemester || undefined
        const ayId = settings?.currentAcademicYear?.id || undefined

        if (settings?.activeSemester) setActiveSemester(settings.activeSemester)

        const [r, schedules] = await Promise.all([
          reportsApi.facultyWorkload({ limit: 500, ...(sem ? { semester: sem } : {}), ...(ayId ? { academic_year_id: ayId } : {}) }),
          schedulesApi.list({ limit: 2000, ...(sem ? { semester: sem } : {}), ...(ayId ? { academic_year_id: ayId } : {}) }),
        ])

        setData(r.data || [])
        setFiltered(r.data || [])
        setAllSchedules((schedules.data || []).filter((s) => s.status === 'active'))
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false))
  }, [])

  const departmentOptions = useMemo(() => {
    const departments = Array.from(new Set(data.map((f) => f.department || 'Unassigned'))).sort((a, b) => a.localeCompare(b))
    return [
      { value: 'all', label: 'All Departments' },
      ...departments.map((d) => ({ value: d, label: d })),
    ]
  }, [data])

  const collegeOptions = useMemo(() => {
    const colleges = Array.from(new Set(data.map((f) => f.college || 'Unassigned'))).sort((a, b) => a.localeCompare(b))
    return [
      { value: 'all', label: 'All Colleges' },
      ...colleges.map((c) => ({ value: c, label: c })),
    ]
  }, [data])

  useEffect(() => {
    const q = search.trim().toLowerCase()

    const next = data.filter((f) => {
      const matchesSearch = !q
        || f.name.toLowerCase().includes(q)
        || (f.employeeId || '').toLowerCase().includes(q)
        || (f.college || '').toLowerCase().includes(q)
        || (f.department || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || f.status === statusFilter
      const facultyCollege = f.college || 'Unassigned'
      const matchesCollege = collegeFilter === 'all' || facultyCollege === collegeFilter
      const facultyDepartment = f.department || 'Unassigned'
      const matchesDepartment = departmentFilter === 'all' || facultyDepartment === departmentFilter

      return matchesSearch && matchesStatus && matchesCollege && matchesDepartment
    })

    setFiltered(next)
  }, [search, data, statusFilter, collegeFilter, departmentFilter])

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
    { key: 'name', header: 'Faculty', render: (f) => <span className="font-medium text-gray-900 dark:text-white">{f.name}</span> },
    { key: 'employeeId', header: 'Employee ID', render: (f) => f.employeeId || '—' },
    { key: 'college', header: 'College', render: (f) => f.college || '—' },
    { key: 'department', header: 'Department', render: (f) => f.department || '—' },
    { key: 'schedules', header: 'Classes', render: (f) => f.schedules },
    { key: 'units', header: 'Units', render: (f) => f.units },
    { key: 'percentage', header: 'Load %', render: (f) => `${f.percentage}%` },
    { key: 'status', header: 'Status', render: (f) => renderStatusBadge(f.status) },
  ]

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Faculty Workload Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Click a faculty row to view the subjects and schedules assigned under that faculty.</p>
        </div>
        {activeSemester && (
          <Badge variant="primary">{activeSemester} Semester</Badge>
        )}
      </div>
      <Card>
        <CardHeader title={`${filtered.length} Faculty Members`} />
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search faculty..." className="max-w-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto md:min-w-[620px]">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'overloaded' | 'optimal' | 'underloaded')}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'overloaded', label: 'Overloaded' },
                { value: 'optimal', label: 'Optimal' },
                { value: 'underloaded', label: 'Underloaded' },
              ]}
            />
            <Select
              label="College"
              value={collegeFilter}
              onChange={(e) => {
                setCollegeFilter(e.target.value)
                setDepartmentFilter('all')
              }}
              options={collegeOptions}
            />
            <Select
              label="Department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Departments' },
                ...departmentOptions.filter((option) => {
                  if (option.value === 'all') return false
                  if (collegeFilter === 'all') return true
                  return data.some((f) => (f.college || 'Unassigned') === collegeFilter && (f.department || 'Unassigned') === option.value)
                }),
              ]}
            />
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
                <div className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-300">
                  <Spinner size="sm" />
                  Loading schedules...
                </div>
              )
            }

            const schedules = facultySchedules[faculty.id] || []
            if (schedules.length === 0) {
              return <p className="text-sm text-gray-500 dark:text-gray-400 py-1">No assigned schedules for this faculty.</p>
            }

            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Assigned Subjects and Schedules</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white dark:bg-gray-800">
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="px-3 py-2 font-medium">Subject</th>
                        <th className="px-3 py-2 font-medium">Section</th>
                        <th className="px-3 py-2 font-medium">Day/Time</th>
                        <th className="px-3 py-2 font-medium">Room</th>
                        <th className="px-3 py-2 font-medium">Units</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {schedules.map((s) => (
                        <tr key={s.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 dark:text-white">{s.subject.code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{s.subject.title}</div>
                          </td>
                          <td className="px-3 py-2">{s.section || '—'}</td>
                          <td className="px-3 py-2">{(s.dayPattern || '—')} {toStandardTime(s.startTime)} - {toStandardTime(s.endTime)}</td>
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
