export interface Curriculum {
  id: number
  name: string
  version: number
  isPublished: boolean
  effectiveYearId: number | null
  notes: string | null
  totalSubjects: number
  totalUnits: number
  department: { id: number; name: string }
  curriculumTerms?: CurriculumTerm[]
  createdAt: string | null
  updatedAt: string | null
}

export interface CurriculumTerm {
  id: number
  yearLevel: number
  semester: string
  termName: string | null
  displayName: string
  totalUnits: number
  curriculumSubjects: CurriculumSubject[]
  createdAt: string
  updatedAt: string
}

export interface CurriculumSubject {
  id: number
  sectionsMapping: Record<string, unknown> | null
  subject: {
    id: number
    code: string
    title: string
    units: number
    lectureHours: number
    labHours: number
    type: string
  }
  createdAt: string
  updatedAt: string
}

export interface CurriculumInput {
  name: string
  version?: number
  isPublished?: boolean
  effectiveYearId?: number
  notes?: string
  departmentId: number
}

export interface CurriculumTermInput {
  yearLevel: number
  semester: string
  termName?: string
}
