export interface College {
  id: number
  code: string
  name: string
  description: string | null
  dean: string | null
  logo: string | null
  isActive: boolean
  departmentCount?: number
  userCount?: number
  createdAt: string
  updatedAt: string | null
}

export interface CollegeInput {
  code: string
  name: string
  description?: string
  dean?: string
  logo?: string
}
