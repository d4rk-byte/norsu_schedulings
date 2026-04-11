'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Home, BookOpen, FileDown } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useAcademicYearFilter } from '@/hooks/useAcademicYearFilter'
import { dhReportsApi, dhSettingsApi, dhLookupsApi, dhSchedulesApi } from '@/lib/department-head-api'
import Link from 'next/link'

interface RoomHistoryItem {
  id: number
  code: string
  name: string
  building: string
  capacity: number | null
  department: { code: string; name: string }
  utilizationPercent: number
}

interface FacultyHistoryItem {
  id: number
  name: string
  employeeId: string | null
  position: string | null
  department: { id: number; code: string; name: string }
  units: number
  percentage: number
}

interface SubjectHistoryItem {
  id: number
  code: string
  title: string
  units: number
  schedules: number
  years: string[]
  semesters: string[]
  faculties: string[]
  rooms: string[]
}

type HistoryTab = 'rooms' | 'faculty' | 'subjects'

export default function DHHistoryReportsPage() {
  const ayFilter = useAcademicYearFilter('/api/department-head')
  const [activeTab, setActiveTab] = useState<HistoryTab>('rooms')
  const [roomData, setRoomData] = useState<RoomHistoryItem[]>([])
  const [facultyData, setFacultyData] = useState<FacultyHistoryItem[]>([])
  const [subjectData, setSubjectData] = useState<SubjectHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportingRoomsPdf, setExportingRoomsPdf] = useState(false)
  const [exportingFacultyPdf, setExportingFacultyPdf] = useState(false)
  const [exportingSubjectsPdf, setExportingSubjectsPdf] = useState(false)
  const [academicYears, setAcademicYears] = useState<any[]>([])

  // Load academic years
  useEffect(() => {
    dhLookupsApi.academicYears()
      .then((res: any) => {
        setAcademicYears(res.data || [])
      })
      .catch(() => {
        setAcademicYears([])
      })
  }, [])

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
        // Keep last known values
      }
    }

    syncSystemPeriod()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load report data
  useEffect(() => {
    setLoading(true)
    setError('')

    const params = {
      academic_year_id: ayFilter.selectedAyId || undefined,
      semester: ayFilter.selectedSemester || undefined,
    }

    Promise.all([
      dhReportsApi.roomUtilization(params).catch((err) => {
        console.error('Room utilization error:', err)
        return []
      }),
      dhReportsApi.facultyWorkload(params).catch((err) => {
        console.error('Faculty workload error:', err)
        return {}
      }),
      dhSchedulesApi.list({
        ...params,
        limit: 1000,
      }).catch((err) => {
        console.error('Schedules error:', err)
        return { data: [] }
      }),
    ])
      .then(([roomRes, facultyRes, scheduleRes]: any[]) => {
        try {
          // Process room data - roomUtilization returns array directly with room utilization info
          const rooms = (Array.isArray(roomRes) ? roomRes : []).map((item: any) => ({
            id: item.room?.id || item.id || 0,
            code: item.room?.code || item.code || 'N/A',
            name: item.room?.name || item.name || 'N/A',
            building: item.room?.building || item.building || 'N/A',
            capacity: item.room?.capacity || item.capacity || null,
            department: item.room?.department || item.department || { code: 'N/A', name: 'N/A' },
            utilizationPercent: item.utilizationPercent || item.utilization_percent || 0,
          }))
          setRoomData(rooms)

          // Process faculty data - facultyWorkload has faculty_workload array and statistics
          const faculty = (facultyRes?.faculty_workload || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            employeeId: item.employeeId || item.employee_id,
            position: item.position || null,
            department: item.department || { id: 0, code: 'N/A', name: 'N/A' },
            units: item.units || 0,
            percentage: item.percentage || 0,
          }))
          setFacultyData(faculty)

          // Build subject offerings from schedules for selected period
          const schedules = Array.isArray(scheduleRes?.data) ? scheduleRes.data : []
          const subjectMap = new Map<number, SubjectHistoryItem>()

          schedules.forEach((schedule: any) => {
            const subject = schedule?.subject
            if (!subject?.id) return

            const existing: SubjectHistoryItem = subjectMap.get(subject.id) || {
              id: subject.id,
              code: subject.code || 'N/A',
              title: subject.title || 'Untitled',
              units: Number(subject.units || 0),
              schedules: 0,
              years: [] as string[],
              semesters: [] as string[],
              faculties: [] as string[],
              rooms: [] as string[],
            }

            existing.schedules += 1

            const year = typeof schedule?.academicYear?.year === 'string' ? schedule.academicYear.year : ''
            if (year && !existing.years.includes(year)) {
              existing.years.push(year)
            }

            const semester = typeof schedule?.semester === 'string' ? schedule.semester : ''
            if (semester && !existing.semesters.includes(semester)) {
              existing.semesters.push(semester)
            }

            const faculty = typeof schedule?.faculty?.fullName === 'string' ? schedule.faculty.fullName : ''
            if (faculty && !existing.faculties.includes(faculty)) {
              existing.faculties.push(faculty)
            }

            const room = typeof schedule?.room?.code === 'string' ? schedule.room.code : ''
            if (room && !existing.rooms.includes(room)) {
              existing.rooms.push(room)
            }

            subjectMap.set(subject.id, existing)
          })

          const subjects = Array.from(subjectMap.values()).sort((a, b) => a.code.localeCompare(b.code))
          setSubjectData(subjects)
        } catch (err) {
          console.error('Error processing data:', err)
          setError('Failed to process report data')
        }
      })
      .catch((err) => {
        console.error('Error loading data:', err)
        setError('Failed to load historical data')
      })
      .finally(() => setLoading(false))
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester])

  function buildExportParams(): Record<string, unknown> {
    return {
      ...(ayFilter.selectedAyId ? { academic_year_id: ayFilter.selectedAyId } : {}),
      ...(ayFilter.selectedSemester ? { semester: ayFilter.selectedSemester } : {}),
    }
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

  async function exportRoomsPdf() {
    if (exportingRoomsPdf) return
    setExportingRoomsPdf(true)

    const previewWindow = window.open('', '_blank')
    if (previewWindow) {
      previewWindow.document.title = 'Generating PDF...'
      previewWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 16px;">Generating PDF preview...</p>'
    }

    try {
      const blob = await dhReportsApi.exportPdf('room-utilization', {
        ...buildExportParams(),
      })
      openPdfPreview(blob, previewWindow)
    } catch (err) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
      console.error('Export error:', err)
      setError('Failed to export room report PDF')
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
      const blob = await dhReportsApi.exportPdf('faculty-workload', {
        ...buildExportParams(),
      })
      openPdfPreview(blob, previewWindow)
    } catch (err) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
      console.error('Export error:', err)
      setError('Failed to export faculty report PDF')
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
      const blob = await dhReportsApi.exportPdf('subject-offerings', {
        ...buildExportParams(),
      })
      openPdfPreview(blob, previewWindow)
    } catch (err) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
      console.error('Export error:', err)
      setError('Failed to export subject offerings PDF')
    } finally {
      setExportingSubjectsPdf(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">History & Reports</h1>
        <p className="mt-1 text-gray-500">Review historical report data and export filtered PDF summaries.</p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/department-head/reports/faculty-workload">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-start justify-between p-6">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Faculty Workload Report</h3>
                <p className="text-sm text-gray-500 mt-1">Open detailed row expansion by faculty</p>
              </div>
              <Button variant="primary" size="sm" icon={<BarChart3 className="h-4 w-4" />}>
                Open
              </Button>
            </div>
          </Card>
        </Link>

        <Link href="/department-head/reports/room-utilization">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-start justify-between p-6">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Room Utilization Report</h3>
                <p className="text-sm text-gray-500 mt-1">Open detailed room usage and schedules</p>
              </div>
              <Button variant="primary" size="sm" icon={<Home className="h-4 w-4" />}>
                Open
              </Button>
            </div>
          </Card>
        </Link>
      </div>

      {/* Filter Historical Data */}
      <Card>
        <CardHeader title="Filter Historical Data" />
        <div className="space-y-4 p-6 border-t">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
              <select
                value={ayFilter.selectedAyId || ''}
                onChange={(e) => ayFilter.setSelectedAyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Years</option>
                {academicYears.map((ay: any) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select
                value={ayFilter.selectedSemester || ''}
                onChange={(e) => ayFilter.setSelectedSemester(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Semesters</option>
                <option value="1st">1st Semester</option>
                <option value="2nd">2nd Semester</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => {
                  ayFilter.setSelectedAyId('')
                  ayFilter.setSelectedSemester('')
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* History Tabs */}
      <Card>
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'rooms'
                ? 'border-teal-500 text-teal-600 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Home className="h-4 w-4" />
            Room History ({roomData.length})
          </button>
          <button
            onClick={() => setActiveTab('faculty')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'faculty'
                ? 'border-teal-500 text-teal-600 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Faculty History ({facultyData.length})
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'subjects'
                ? 'border-teal-500 text-teal-600 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Subject Offerings ({subjectData.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && <Alert variant="error">{error}</Alert>}

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : activeTab === 'rooms' ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">Showing {roomData.length} of {roomData.length} rooms</p>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full sm:w-auto whitespace-nowrap"
                    icon={<FileDown className="h-4 w-4" />}
                    onClick={exportRoomsPdf}
                    loading={exportingRoomsPdf}
                  >
                    {exportingRoomsPdf ? 'Exporting...' : `Export (${roomData.length}) PDF`}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Room</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Building</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Capacity</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                          No room data available for selected period
                        </td>
                      </tr>
                    ) : (
                      roomData.map((room) => (
                        <tr key={room.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{room.code}</span>
                            <br />
                            <span className="text-gray-500 text-xs">{room.name}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{room.building}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100">
                              {room.department?.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{room.capacity ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${
                              room.utilizationPercent > 80 ? 'text-red-600' :
                              room.utilizationPercent > 50 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {room.utilizationPercent}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'faculty' ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">Showing {facultyData.length} of {facultyData.length} faculty members</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto whitespace-nowrap"
                  icon={<FileDown className="h-4 w-4" />}
                  onClick={exportFacultyPdf}
                  loading={exportingFacultyPdf}
                >
                  {exportingFacultyPdf ? 'Exporting...' : `Export (${facultyData.length}) PDF`}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Faculty Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Employee ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Units</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Load %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                          No faculty data available for selected period
                        </td>
                      </tr>
                    ) : (
                      facultyData.map((faculty) => (
                        <tr key={faculty.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{faculty.name}</td>
                          <td className="px-4 py-3 text-gray-600">{faculty.employeeId || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100">
                              {faculty.department?.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{faculty.units}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${
                              faculty.percentage > 100 ? 'text-red-600' :
                              faculty.percentage >= 85 ? 'text-green-600' :
                              'text-yellow-600'
                            }`}>
                              {Math.round(faculty.percentage)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">Showing {subjectData.length} of {subjectData.length} subjects</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto whitespace-nowrap"
                  icon={<FileDown className="h-4 w-4" />}
                  onClick={exportSubjectsPdf}
                  loading={exportingSubjectsPdf}
                >
                  {exportingSubjectsPdf ? 'Exporting...' : `Export (${subjectData.length}) PDF`}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Code</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Units</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Schedules</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Years</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Semesters</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Faculty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                          No subject offerings available for selected period
                        </td>
                      </tr>
                    ) : (
                      subjectData.map((subject) => (
                        <tr key={subject.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-blue-700">{subject.code}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{subject.title}</td>
                          <td className="px-4 py-3 text-gray-600">{subject.units}</td>
                          <td className="px-4 py-3 text-gray-600">{subject.schedules}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{subject.years.join(', ') || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{subject.semesters.join(', ') || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{subject.faculties.slice(0, 3).join(', ') || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
