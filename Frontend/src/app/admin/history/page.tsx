'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, BookOpen, Building2, FileDown, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { academicYearsApi, collegesApi, departmentsApi, reportsApi } from '@/lib/admin-api'
import { cn } from '@/lib/utils'

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

interface SubjectOfferingRow {
  id: number
  code: string
  title: string
  units: number
  type: string | null
  department: string | null
  college: string | null
  schedules: number
}

type TabKey = 'rooms' | 'faculty' | 'subjects'

function toCsvValue(value: unknown): string {
  const raw = String(value ?? '')
  const escaped = raw.replace(/"/g, '""')
  return `"${escaped}"`
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csvRows = [headers, ...rows]
  const csv = csvRows.map((row) => row.map(toCsvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function openPdfPreview(blob: Blob, previewWindow?: Window | null) {
  const url = URL.createObjectURL(blob)

  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.href = url
  } else {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.click()
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export default function HistoryReportsPage() {
  const [tab, setTab] = useState<TabKey>('rooms')
  const [reportLoading, setReportLoading] = useState(true)
  const [reportError, setReportError] = useState('')

  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedCollege, setSelectedCollege] = useState('all')
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('all')
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [search, setSearch] = useState('')

  const [collegeOptions, setCollegeOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'all', label: 'All Colleges' },
  ])
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'all', label: 'All Departments' },
  ])
  const [departmentCollegeMap, setDepartmentCollegeMap] = useState<Record<string, string>>({})
  const [yearOptions, setYearOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'all', label: 'All Years' },
  ])

  const [rooms, setRooms] = useState<RoomUtilRow[]>([])
  const [faculty, setFaculty] = useState<FacultyWorkloadRow[]>([])
  const [subjects, setSubjects] = useState<SubjectOfferingRow[]>([])

  const [exportingRoomsPdf, setExportingRoomsPdf] = useState(false)
  const [exportingFacultyPdf, setExportingFacultyPdf] = useState(false)
  const [exportingSubjectsPdf, setExportingSubjectsPdf] = useState(false)

  const semesterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Semesters' },
      { value: '1st', label: '1st Semester' },
      { value: '2nd', label: '2nd Semester' },
      { value: 'Summer', label: 'Summer' },
    ],
    []
  )

  function buildReportParams(limit: number): Record<string, unknown> {
    const params: Record<string, unknown> = { limit }

    if (selectedAcademicYearId === 'all') {
      params.all_years = true
    } else {
      params.academic_year_id = Number(selectedAcademicYearId)
    }

    if (selectedSemester === 'all') {
      params.semester = 'all'
    } else {
      params.semester = selectedSemester
    }

    return params
  }

  async function loadReportsData() {
    setReportLoading(true)
    setReportError('')

    const [facultyResult, roomsResult, subjectsResult] = await Promise.allSettled([
      reportsApi.facultyWorkload(buildReportParams(1000)),
      reportsApi.roomUtilization(buildReportParams(1000)),
      reportsApi.subjectOfferings(buildReportParams(1500)),
    ])

    if (facultyResult.status === 'fulfilled') {
      setFaculty(facultyResult.value.data || [])
    }

    if (roomsResult.status === 'fulfilled') {
      setRooms(roomsResult.value.data || [])
    }

    if (subjectsResult.status === 'fulfilled') {
      setSubjects(subjectsResult.value.data || [])
    }

    if ([facultyResult, roomsResult, subjectsResult].some((r) => r.status === 'rejected')) {
      setReportError('Some report data failed to load. Please refresh or try again.')
    }

    setReportLoading(false)
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const [collegesResponse, departmentsResponse, yearsResponse] = await Promise.all([
          collegesApi.list({ limit: 1000 }),
          departmentsApi.list({ limit: 1000 }),
          academicYearsApi.list({ limit: 1000, sort: 'year', direction: 'desc' }),
        ])

        const collegeNames = Array.from(
          new Set((collegesResponse.data || []).map((c) => c.name).filter(Boolean) as string[])
        ).sort((a, b) => a.localeCompare(b))

        setCollegeOptions([
          { value: 'all', label: 'All Colleges' },
          ...collegeNames.map((name) => ({ value: name, label: name })),
        ])

        const departmentNames = Array.from(
          new Set((departmentsResponse.data || []).map((d) => d.name).filter(Boolean) as string[])
        ).sort((a, b) => a.localeCompare(b))

        const depToCollege: Record<string, string> = {}
        for (const department of departmentsResponse.data || []) {
          if (department.name) {
            depToCollege[department.name] = department.college?.name || 'Unassigned'
          }
        }
        setDepartmentCollegeMap(depToCollege)

        setDepartmentOptions([
          { value: 'all', label: 'All Departments' },
          ...departmentNames.map((name) => ({ value: name, label: name })),
        ])

        const years = Array.from(
          new Set((yearsResponse.data || []).map((y) => y.year).filter(Boolean) as string[])
        ).sort((a, b) => b.localeCompare(a))

        setYearOptions([
          { value: 'all', label: 'All Years' },
          ...years.map((year) => {
            const matching = (yearsResponse.data || []).find((item) => item.year === year)
            return { value: String(matching?.id || year), label: year }
          }),
        ])
      } catch {
        setReportError('Failed to load filters data.')
      }
    }

    bootstrap()
  }, [])

  useEffect(() => {
    loadReportsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAcademicYearId, selectedSemester])

  const visibleDepartmentOptions = useMemo(() => {
    if (selectedCollege === 'all') return departmentOptions

    return [
      { value: 'all', label: 'All Departments' },
      ...departmentOptions.filter((opt) => {
        if (opt.value === 'all') return false
        return departmentCollegeMap[opt.value] === selectedCollege
      }),
    ]
  }, [selectedCollege, departmentOptions, departmentCollegeMap])

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rooms.filter((row) => {
      const matchesCollege = selectedCollege === 'all' || (row.college || 'Unassigned') === selectedCollege
      const matchesDepartment = selectedDepartment === 'all' || (row.department || 'Unassigned') === selectedDepartment
      const matchesSearch = !q
        || row.code.toLowerCase().includes(q)
        || (row.name || '').toLowerCase().includes(q)
        || (row.building || '').toLowerCase().includes(q)
        || (row.department || '').toLowerCase().includes(q)
        || (row.college || '').toLowerCase().includes(q)

      return matchesCollege && matchesDepartment && matchesSearch
    })
  }, [rooms, selectedCollege, selectedDepartment, search])

  const filteredFaculty = useMemo(() => {
    const q = search.trim().toLowerCase()

    return faculty.filter((row) => {
      const matchesCollege = selectedCollege === 'all' || (row.college || 'Unassigned') === selectedCollege
      const matchesDepartment = selectedDepartment === 'all' || (row.department || 'Unassigned') === selectedDepartment
      const matchesSearch = !q
        || row.name.toLowerCase().includes(q)
        || (row.employeeId || '').toLowerCase().includes(q)
        || (row.department || '').toLowerCase().includes(q)
        || (row.college || '').toLowerCase().includes(q)

      return matchesCollege && matchesDepartment && matchesSearch
    })
  }, [faculty, selectedCollege, selectedDepartment, search])

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase()

    return subjects.filter((row) => {
      const matchesCollege = selectedCollege === 'all' || (row.college || 'Unassigned') === selectedCollege
      const matchesDepartment = selectedDepartment === 'all' || (row.department || 'Unassigned') === selectedDepartment
      const matchesSearch = !q
        || row.code.toLowerCase().includes(q)
        || row.title.toLowerCase().includes(q)
        || (row.department || '').toLowerCase().includes(q)
        || (row.college || '').toLowerCase().includes(q)

      return matchesCollege && matchesDepartment && matchesSearch
    })
  }, [subjects, selectedCollege, selectedDepartment, search])

  const roomColumns: Column<RoomUtilRow>[] = [
    { key: 'code', header: 'Room' },
    { key: 'building', header: 'Building', render: (r) => r.building || '—' },
    { key: 'capacity', header: 'Capacity', render: (r) => r.capacity ?? '—' },
    { key: 'schedules', header: 'Schedule Count' },
  ]

  const facultyColumns: Column<FacultyWorkloadRow>[] = [
    { key: 'name', header: 'Faculty Name' },
    { key: 'employeeId', header: 'Employee ID', render: (f) => f.employeeId || '—' },
    { key: 'department', header: 'Department', render: (f) => f.department || '—' },
    {
      key: 'teachingLoad',
      header: 'Teaching Load',
      render: (f) => (
        <div className="flex items-center gap-2">
          <Badge variant="success">{f.units} units</Badge>
          <Badge variant="primary">{f.schedules} subjects</Badge>
        </div>
      ),
    },
  ]

  const subjectColumns: Column<SubjectOfferingRow>[] = [
    { key: 'code', header: 'Code' },
    { key: 'title', header: 'Subject Title' },
    { key: 'department', header: 'Department', render: (s) => s.department || '—' },
    { key: 'units', header: 'Units' },
    { key: 'type', header: 'Type', render: (s) => s.type || '—' },
    { key: 'schedules', header: 'Offerings' },
  ]

  async function exportRoomsPdf() {
    if (exportingRoomsPdf) return
    setExportingRoomsPdf(true)
    const previewWindow = window.open('', '_blank')
    if (previewWindow) {
      previewWindow.document.title = 'Generating PDF...'
      previewWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 16px;">Generating PDF preview...</p>'
    }
    try {
      const blob = await reportsApi.exportPdf('room-utilization', {
        ...buildReportParams(2000),
        ...(selectedCollege !== 'all' ? { college: selectedCollege } : {}),
        ...(selectedDepartment !== 'all' ? { department: selectedDepartment } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })

      openPdfPreview(blob, previewWindow)
    } catch {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
    } finally {
      setExportingRoomsPdf(false)
    }
  }

  async function exportFacultyPdf() {
    if (exportingFacultyPdf) return
    setExportingFacultyPdf(true)
    const previewWindow = window.open('', '_blank')
    if (previewWindow) {
      previewWindow.document.title = 'Generating PDF...'
      previewWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 16px;">Generating PDF preview...</p>'
    }
    try {
      const blob = await reportsApi.exportPdf('faculty-workload', {
        ...buildReportParams(2000),
        ...(selectedCollege !== 'all' ? { college: selectedCollege } : {}),
        ...(selectedDepartment !== 'all' ? { department: selectedDepartment } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })

      openPdfPreview(blob, previewWindow)
    } catch {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
    } finally {
      setExportingFacultyPdf(false)
    }
  }

  async function exportSubjectsPdf() {
    if (exportingSubjectsPdf) return
    setExportingSubjectsPdf(true)
    const previewWindow = window.open('', '_blank')
    if (previewWindow) {
      previewWindow.document.title = 'Generating PDF...'
      previewWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 16px;">Generating PDF preview...</p>'
    }
    try {
      const blob = await reportsApi.exportPdf('subject-offerings', {
        ...buildReportParams(2000),
        ...(selectedCollege !== 'all' ? { college: selectedCollege } : {}),
        ...(selectedDepartment !== 'all' ? { department: selectedDepartment } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })

      openPdfPreview(blob, previewWindow)
    } catch {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
    } finally {
      setExportingSubjectsPdf(false)
    }
  }

  function exportRoomsCsv() {
    downloadCsv(
      `room_history_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Room', 'Building', 'Capacity', 'Schedule Count', 'College', 'Department'],
      filteredRooms.map((r) => [r.code, r.building || '', r.capacity ?? '', r.schedules, r.college || '', r.department || ''])
    )
  }

  function exportFacultyCsv() {
    downloadCsv(
      `faculty_history_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Faculty Name', 'Employee ID', 'Department', 'College', 'Units', 'Subjects'],
      filteredFaculty.map((f) => [f.name, f.employeeId || '', f.department || '', f.college || '', f.units, f.schedules])
    )
  }

  function clearFilters() {
    setSelectedCollege('all')
    setSelectedDepartment('all')
    setSelectedAcademicYearId('all')
    setSelectedSemester('all')
    setSearch('')
  }

  const statusText = selectedCollege !== 'all' || selectedDepartment !== 'all' || selectedAcademicYearId !== 'all' || selectedSemester !== 'all' || !!search.trim()
    ? 'Filtered historical data'
    : 'Showing all historical data'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">History & Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review historical report data and export filtered PDF summaries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Faculty Workload Report</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">Open detailed row expansion by faculty</p>
            </div>
            <Link href="/admin/reports/faculty-workload">
              <Button size="sm" icon={<BarChart3 className="h-4 w-4" />}>Open</Button>
            </Link>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Room Utilization Report</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">Open detailed room usage and schedules</p>
            </div>
            <Link href="/admin/reports/room-utilization">
              <Button size="sm" icon={<Building2 className="h-4 w-4" />}>Open</Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Filter Historical Data</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{statusText}</span>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-gray-300">Search</label>
              <SearchBar value={search} onChange={setSearch} placeholder="Room name, faculty name..." />
            </div>

            <div className="min-w-0">
              <Select
                label="College"
                value={selectedCollege}
                onChange={(e) => {
                  setSelectedCollege(e.target.value)
                  setSelectedDepartment('all')
                }}
                options={collegeOptions}
              />
            </div>

            <div className="min-w-0">
              <Select label="Department" value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} options={visibleDepartmentOptions} />
            </div>

            <div className="min-w-0">
              <Select label="Academic Year" value={selectedAcademicYearId} onChange={(e) => setSelectedAcademicYearId(e.target.value)} options={yearOptions} />
            </div>

            <div className="min-w-0">
              <Select label="Semester" value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} options={semesterOptions} />
            </div>
          </div>

          <div className="xl:pb-px">
            <Button variant="secondary" onClick={clearFilters} className="w-full sm:w-auto">Clear</Button>
          </div>
        </div>
      </Card>

      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        {[
          { key: 'rooms', label: `Room History (${rooms.length})`, icon: <Building2 className="h-4 w-4" /> },
          { key: 'faculty', label: `Faculty History (${faculty.length})`, icon: <Users className="h-4 w-4" /> },
          { key: 'subjects', label: `Subject Offerings (${subjects.length})`, icon: <BookOpen className="h-4 w-4" /> },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
              tab === item.key ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
            onClick={() => setTab(item.key as TabKey)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {reportError && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{reportError}</div>}

      {tab === 'rooms' && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Room Usage History</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Showing {filteredRooms.length} of {rooms.length} rooms</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button size="sm" className="w-full sm:w-auto whitespace-nowrap" variant="secondary" onClick={exportRoomsCsv} icon={<FileDown className="h-4 w-4" />}>
                Export ({filteredRooms.length}) CSV
              </Button>
              <Button size="sm" className="w-full sm:w-auto whitespace-nowrap" onClick={exportRoomsPdf} disabled={exportingRoomsPdf} icon={<FileDown className="h-4 w-4" />}>
                {exportingRoomsPdf ? 'Exporting...' : `Export (${filteredRooms.length}) PDF`}
              </Button>
            </div>
          </div>

          <DataTable columns={roomColumns} data={filteredRooms} keyExtractor={(r) => r.id} loading={reportLoading} emptyTitle="No rooms found" emptyDescription="Try adjusting your filters." />
        </Card>
      )}

      {tab === 'faculty' && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty Teaching History</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Showing {filteredFaculty.length} of {faculty.length} faculty members</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button size="sm" className="w-full sm:w-auto whitespace-nowrap" variant="secondary" onClick={exportFacultyCsv} icon={<FileDown className="h-4 w-4" />}>
                Export ({filteredFaculty.length}) CSV
              </Button>
              <Button size="sm" className="w-full sm:w-auto whitespace-nowrap" onClick={exportFacultyPdf} disabled={exportingFacultyPdf} icon={<FileDown className="h-4 w-4" />}>
                {exportingFacultyPdf ? 'Exporting...' : `Export (${filteredFaculty.length}) PDF`}
              </Button>
            </div>
          </div>

          <DataTable columns={facultyColumns} data={filteredFaculty} keyExtractor={(f) => f.id} loading={reportLoading} emptyTitle="No faculty found" emptyDescription="Try adjusting your filters." />
        </Card>
      )}

      {tab === 'subjects' && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Subject Offerings Report</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Showing {filteredSubjects.length} of {subjects.length} subjects</p>
            </div>
            <Button size="sm" className="w-full sm:w-auto whitespace-nowrap" onClick={exportSubjectsPdf} disabled={exportingSubjectsPdf} icon={<FileDown className="h-4 w-4" />}>
              {exportingSubjectsPdf ? 'Exporting...' : `Export (${filteredSubjects.length}) PDF`}
            </Button>
          </div>

          <DataTable columns={subjectColumns} data={filteredSubjects} keyExtractor={(s) => s.id} loading={reportLoading} emptyTitle="No subjects found" emptyDescription="Try adjusting your filters." />
        </Card>
      )}
    </div>
  )
}
