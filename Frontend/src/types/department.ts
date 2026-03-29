export interface Department {
  id: number
  code: string
  name: string
  description: string | null
  contactEmail: string | null
  isActive: boolean
  head: { id: number; fullName: string } | null
  college: { id: number; name: string } | null
  departmentGroup: { id: number; name: string } | null
  userCount?: number
  createdAt: string
  updatedAt: string
}

export interface DepartmentInput {
  code: string
  name: string
  description?: string
  contactEmail?: string
  headId?: number
  collegeId?: number
  departmentGroupId?: number
}
