'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'

/**
 * Lightweight hook that fetches the current AY + semester label
 * from the /settings endpoint.  Used by layout headers.
 */
export function useCurrentSemester(apiPrefix: string) {
  const [label, setLabel] = useState<string>('')

  useEffect(() => {
    api.get(`${apiPrefix}/settings`)
      .then(res => {
        const d = res.data?.data
        if (d?.currentAcademicYear && d?.activeSemester) {
          setLabel(`${d.currentAcademicYear.year} — ${d.activeSemester} Semester`)
        }
      })
      .catch(() => {})
  }, [apiPrefix])

  return label
}
