export interface Subject {
  id: number
  code: string
  title: string
  description: string | null
  units: number
  lectureHours: number
  labHours: number
  type: string
  yearLevel: number | null
  semester: string | null
  isActive: boolean
  department: { id: number; name: string }
  createdAt: string
  updatedAt: string
}

export interface SubjectInput {
  code: string
  title: string
  description?: string
  units: number
  lectureHours?: number
  labHours?: number
  type?: string
  yearLevel?: number
  semester?: string
  departmentId: number
}
