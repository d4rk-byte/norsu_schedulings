export interface AcademicYear {
  id: number
  year: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  currentSemester: string | null
  isActive: boolean
  firstSemStart: string | null
  firstSemEnd: string | null
  secondSemStart: string | null
  secondSemEnd: string | null
  summerStart: string | null
  summerEnd: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface AcademicYearInput {
  year: string
  startDate?: string
  endDate?: string
  isCurrent?: boolean
  currentSemester?: string
  firstSemStart?: string
  firstSemEnd?: string
  secondSemStart?: string
  secondSemEnd?: string
  summerStart?: string
  summerEnd?: string
}
