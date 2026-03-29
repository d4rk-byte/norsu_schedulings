'use client'

import { Fragment, useEffect, useState } from 'react'
import { Loader2, Download } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useAcademicYearFilter } from '@/hooks/useAcademicYearFilter'
import { dhReportsApi, dhSchedulesApi, dhSettingsApi, dhLookupsApi } from '@/lib/department-head-api'
import type { Schedule } from '@/types'

interface UtilizationItem {
  room: {
    id: number
    code: string
    name: string
    capacity: number | null
    building?: string
    department?: { id: number; code: string; name: string } | null
  }
  scheduledHours: number
  availableHours: number
  utilizationPercent: number
}

export default function DHReportsRoomUtilizationPage() {
  const ayFilter = useAcademicYearFilter('/api/department-head')
  const [data, setData] = useState<UtilizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null)
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null)
  const [roomSchedules, setRoomSchedules] = useState<Record<number, Schedule[]>>({})

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
    setExpandedRoomId(null)
    setDetailsLoadingId(null)
    setRoomSchedules({})

    const params = {
      academic_year_id: ayFilter.selectedAyId || undefined,
      semester: ayFilter.selectedSemester || undefined,
    }

    dhReportsApi.roomUtilization(params)
      .then((res: any) => {
        try {
          const items = Array.isArray(res) ? res : res.data || []
          setData(items)
        } catch (err) {
          console.error('Error processing room utilization data:', err)
          setError('Failed to process report data')
        }
      })
      .catch((err) => {
        console.error('Room utilization report error:', err)
        setError('Failed to load report. Please check your filters and try again.')
      })
      .finally(() => setLoading(false))
  }, [ayFilter.selectedAyId, ayFilter.selectedSemester])

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await dhReportsApi.exportPdf('room-utilization', {
        academic_year_id: ayFilter.selectedAyId,
        semester: ayFilter.selectedSemester,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `room-utilization-report-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export PDF')
    }
    setExporting(false)
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

  async function handleRoomClick(roomId: number) {
    if (expandedRoomId === roomId) {
      setExpandedRoomId(null)
      return
    }

    setExpandedRoomId(roomId)
    if (roomSchedules[roomId]) return

    setDetailsLoadingId(roomId)
    try {
      const response = await dhSchedulesApi.list({
        limit: 2000,
        ...(ayFilter.selectedAyId ? { academic_year_id: ayFilter.selectedAyId } : {}),
        ...(ayFilter.selectedSemester ? { semester: ayFilter.selectedSemester } : {}),
      })

      const schedules = (response.data || []).filter((schedule) => schedule.status === 'active' && schedule.room?.id === roomId)
      setRoomSchedules((prev) => ({ ...prev, [roomId]: schedules }))
    } catch {
      setRoomSchedules((prev) => ({ ...prev, [roomId]: [] }))
    } finally {
      setDetailsLoadingId(null)
    }
  }

  function getBar(pct: number) {
    const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
        <span className="text-xs font-medium">{pct}%</span>
      </div>
    )
  }

  function getUtilizationBadge(pct: number) {
    if (pct > 80) return <Badge variant="error">High</Badge>
    if (pct > 50) return <Badge variant="warning">Moderate</Badge>
    return <Badge variant="success">Low</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Room Utilization Report</h1>
          <p className="mt-1 text-sm text-gray-500">Usage statistics for department rooms</p>
        </div>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport} loading={exporting}>Export PDF</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader title="Filter by Period" />
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

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <Card>
          {data.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No utilization data available for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-700">Room</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Building</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Department</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Capacity</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-center">Scheduled Hrs</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-center">Available Hrs</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Utilization</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => {
                    const schedules = roomSchedules[item.room.id] || []
                    const isExpanded = expandedRoomId === item.room.id
                    return (
                      <Fragment key={item.room.id}>
                        <tr
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleRoomClick(item.room.id)}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{item.room.code}</span>
                            <br />
                            <span className="text-gray-500 text-xs">{item.room.name}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.room.building || '—'}</td>
                          <td className="px-4 py-3">
                            {item.room.department ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700">
                                {item.room.department.code}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.room.capacity ?? '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{item.scheduledHours}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{item.availableHours}</td>
                          <td className="px-4 py-3">{getBar(item.utilizationPercent)}</td>
                          <td className="px-4 py-3">{getUtilizationBadge(item.utilizationPercent)}</td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-gray-50 border-b last:border-0">
                            <td colSpan={8} className="px-4 py-3">
                              {detailsLoadingId === item.room.id ? (
                                <div className="flex items-center gap-2 py-2 text-sm text-gray-600">
                                  <Spinner size="sm" />
                                  Loading schedules...
                                </div>
                              ) : schedules.length === 0 ? (
                                <p className="text-sm text-gray-500 py-1">No schedules found for this room in the selected period.</p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Room Schedules</p>
                                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="min-w-full text-sm bg-white">
                                      <thead className="bg-white">
                                        <tr className="text-left text-gray-500 border-b">
                                          <th className="px-3 py-2 font-medium">Subject</th>
                                          <th className="px-3 py-2 font-medium">Faculty</th>
                                          <th className="px-3 py-2 font-medium">Section</th>
                                          <th className="px-3 py-2 font-medium">Day/Time</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {schedules.map((schedule) => (
                                          <tr key={schedule.id} className="border-b last:border-b-0">
                                            <td className="px-3 py-2">
                                              <div className="font-medium text-gray-900">{schedule.subject.code}</div>
                                              <div className="text-xs text-gray-500">{schedule.subject.title}</div>
                                            </td>
                                            <td className="px-3 py-2">{schedule.faculty?.fullName || 'Unassigned'}</td>
                                            <td className="px-3 py-2">{schedule.section || '—'}</td>
                                            <td className="px-3 py-2">{(schedule.dayPattern || '—')} {toStandardTime(schedule.startTime)} - {toStandardTime(schedule.endTime)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
