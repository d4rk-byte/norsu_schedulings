'use client'

import { useState, useEffect, useMemo } from 'react'
import type { AcademicYear } from '@/types'
import { SEMESTERS } from '@/lib/constants'
import api from '@/lib/api'

interface AcademicYearOption {
  value: string
  label: string
}

interface UseAcademicYearFilterReturn {
  academicYears: AcademicYear[]
  ayOptions: AcademicYearOption[]
  semesterOptions: AcademicYearOption[]
  selectedAyId: string
  selectedSemester: string
  setSelectedAyId: (v: string) => void
  setSelectedSemester: (v: string) => void
  filterParams: Record<string, unknown>
  currentLabel: string
  loading: boolean
}

/**
 * Hook that loads active academic years and provides AY + semester filter state.
 * Pass `apiPrefix` for the role (e.g. '/api/admin' or '/api/department-head').
 * For DH, academic years are fetched from the admin endpoint (shared data).
 */
export function useAcademicYearFilter(apiPrefix: string = '/api/admin'): UseAcademicYearFilterReturn {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedAyId, setSelectedAyId] = useState<string>('')
  const [selectedSemester, setSelectedSemester] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`${apiPrefix}/academic-years`, { params: { limit: 50 } })
      .then(res => {
        const items: AcademicYear[] = res.data?.data ?? []
        setAcademicYears(items)

        // Pre-select the current one
        const current = items.find(a => a.isCurrent)
        if (current) {
          setSelectedAyId(String(current.id))
          setSelectedSemester(current.currentSemester || '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [apiPrefix])

  const ayOptions: AcademicYearOption[] = [
    { value: '', label: 'All Academic Years' },
    ...academicYears.filter(a => a.isActive).map(a => ({
      value: String(a.id),
      label: a.year + (a.isCurrent ? ' (Current)' : ''),
    })),
  ]

  const semesterOptions: AcademicYearOption[] = [
    { value: '', label: 'All Semesters' },
    ...SEMESTERS.map(s => ({ value: s, label: `${s} Semester` })),
  ]

  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (selectedAyId) p.academic_year_id = selectedAyId
    if (selectedSemester) p.semester = selectedSemester
    return p
  }, [selectedAyId, selectedSemester])

  const selectedAy = academicYears.find(a => String(a.id) === selectedAyId)
  let currentLabel = 'All Periods'
  if (selectedAy) {
    currentLabel = selectedAy.year
    if (selectedSemester) currentLabel += ` — ${selectedSemester} Semester`
  }

  return {
    academicYears,
    ayOptions,
    semesterOptions,
    selectedAyId,
    selectedSemester,
    setSelectedAyId,
    setSelectedSemester,
    filterParams,
    currentLabel,
    loading,
  }
}
