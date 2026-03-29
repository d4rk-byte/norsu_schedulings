'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Users,
  Clock,
  MapPin,
  CalendarDays,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { SEMESTERS } from '@/lib/constants'
import { facultyApi, type FacultyClassesResponse, type FacultyScheduleItem } from '@/lib/faculty-api'

export default function FacultyClassesPage() {
  const [semester, setSemester] = useState('')
  const [data, setData] = useState<FacultyClassesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [savingClassId, setSavingClassId] = useState<number | null>(null)
  const [highlightedClassId, setHighlightedClassId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)

  const fetchData = async (sem?: string) => {
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await facultyApi.classes(sem || undefined)
      setData(res)
      if (!sem) setSemester(res.semester)
    } catch {
      setError('Failed to load classes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSemester(val)
    fetchData(val)
  }

  const handleStudentCountSave = async (classId: number, enrolledStudents: number): Promise<boolean> => {
    setError('')
    setSuccessMessage('')
    setSavingClassId(classId)

    try {
      const res = await facultyApi.updateClassEnrolledStudents(classId, enrolledStudents)

      setData((prev) => {
        if (!prev) return prev

        const currentClass = prev.classes.find((cls) => cls.id === classId)
        if (!currentClass) return prev

        const previousStudents = currentClass.enrolled_students ?? 0
        const nextStudents = res.data.enrolled_students ?? enrolledStudents
        const delta = nextStudents - previousStudents

        return {
          ...prev,
          classes: prev.classes.map((cls) => (
            cls.id === classId
              ? { ...cls, enrolled_students: nextStudents }
              : cls
          )),
          stats: {
            ...prev.stats,
            total_students: prev.stats.total_students + delta,
          },
        }
      })

      setSuccessMessage('Class student count updated successfully.')
      setHighlightedClassId(classId)

      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
      }

      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedClassId((current) => (current === classId ? null : current))
      }, 1800)

      return true
    } catch {
      setError('Failed to update student count. Please try again.')
      return false
    } finally {
      setSavingClassId(null)
    }
  }

  const stats = data?.stats

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white/90">Current Classes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {data?.academic_year ? `${data.academic_year.year}` : ''} {semester ? `— ${semester} Semester` : ''}
          </p>
        </div>
        <div className="w-full sm:w-56 sm:flex-none">
          <Select
            value={semester}
            onChange={handleSemesterChange}
            options={SEMESTERS.map(s => ({ value: s, label: `${s} Semester` }))}
            className="w-full"
          />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {successMessage && (
        <Alert variant="success" onDismiss={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Classes', value: stats.total_classes, icon: BookOpen, bg: 'bg-blue-50 dark:bg-blue-500/15', color: 'text-blue-600 dark:text-blue-300' },
            { label: 'Total Students', value: stats.total_students, icon: Users, bg: 'bg-green-50 dark:bg-green-500/15', color: 'text-green-600 dark:text-green-300' },
            { label: 'Teaching Hours', value: stats.teaching_hours, icon: Clock, bg: 'bg-amber-50 dark:bg-amber-500/15', color: 'text-amber-600 dark:text-amber-300' },
          ].map((s) => (
            <Card key={s.label}>
              <div className="flex items-center gap-3">
                <div className={`${s.bg} p-2.5 rounded-lg`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white/90">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
      ) : (data?.classes ?? []).length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No classes found for this semester.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data?.classes ?? []).map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              saving={savingClassId === cls.id}
              highlighted={highlightedClassId === cls.id}
              onSaveStudents={handleStudentCountSave}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type SaveStudentsHandler = (classId: number, enrolledStudents: number) => Promise<boolean>

function formatUpdatedAt(updatedAt?: string | null): string {
  if (!updatedAt) {
    return 'Not yet updated'
  }

  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available'
  }

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ClassCard({ cls, saving, highlighted, onSaveStudents }: { cls: FacultyScheduleItem; saving: boolean; highlighted: boolean; onSaveStudents: SaveStudentsHandler }) {
  const [isEditingStudents, setIsEditingStudents] = useState(false)
  const [studentInput, setStudentInput] = useState(String(cls.enrolled_students ?? 0))
  const [studentError, setStudentError] = useState('')

  const handleSaveStudents = async () => {
    const trimmed = studentInput.trim()
    const isWholeNumber = /^\d+$/.test(trimmed)

    if (!isWholeNumber) {
      setStudentError('Enter a valid whole number (0 or higher).')
      return
    }

    const parsedValue = Number.parseInt(trimmed, 10)

    if (parsedValue < 0) {
      setStudentError('Student count cannot be negative.')
      return
    }

    if (parsedValue === (cls.enrolled_students ?? 0)) {
      setIsEditingStudents(false)
      setStudentError('')
      return
    }

    setStudentError('')
    const success = await onSaveStudents(cls.id, parsedValue)

    if (success) {
      setIsEditingStudents(false)
    } else {
      setStudentError('Unable to save student count.')
    }
  }

  const handleCancelEdit = () => {
    setIsEditingStudents(false)
    setStudentInput(String(cls.enrolled_students ?? 0))
    setStudentError('')
  }

  return (
    <Card className={`transition-all duration-700 ${highlighted ? 'ring-2 ring-emerald-300 bg-emerald-50/70 shadow-md shadow-emerald-100/70 dark:ring-emerald-500/40 dark:bg-emerald-900/20 dark:shadow-none' : 'hover:shadow-md'}`}>
      <div className="space-y-3">
        {/* Subject header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-white/90">{cls.subject.code}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{cls.subject.title}</p>
          </div>
          <Badge variant={cls.subject.type === 'laboratory' ? 'warning' : cls.subject.type === 'lecture-lab' ? 'info' : 'primary'}>
            {cls.subject.type ?? 'lecture'}
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span>{cls.day_pattern_label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span>{cls.start_time_12h} — {cls.end_time_12h}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span>{cls.room.code}{cls.room.name ? ` — ${cls.room.name}` : ''}</span>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />

            {!isEditingStudents ? (
              <div className="flex w-full items-center justify-between gap-3">
                <span>{cls.enrolled_students} students enrolled</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => {
                    setStudentInput(String(cls.enrolled_students ?? 0))
                    setStudentError('')
                    setIsEditingStudents(true)
                  }}
                  disabled={saving}
                >
                  Edit
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={studentInput}
                  onChange={(event) => setStudentInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void handleSaveStudents()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      handleCancelEdit()
                    }
                  }}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  aria-label={`Enrolled students for ${cls.subject.code}`}
                  disabled={saving}
                />
                {studentError && <p className="text-xs text-red-600 dark:text-red-400">{studentError}</p>}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    loading={saving}
                    onClick={() => {
                      void handleSaveStudents()
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Last updated: {formatUpdatedAt(cls.updated_at)}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/70">
          <span className="text-xs text-gray-400 dark:text-gray-500">Section {cls.section ?? '—'}</span>
          <Badge variant="default">{cls.subject.units} units</Badge>
        </div>
      </div>
    </Card>
  )
}
