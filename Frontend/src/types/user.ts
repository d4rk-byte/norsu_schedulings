export interface User {
  id: number
  username: string
  email: string
  firstName: string | null
  middleName: string | null
  lastName: string | null
  fullName: string
  role: number
  roleString: string
  roleDisplayName: string
  employeeId: string | null
  position: string | null
  address: string | null
  otherDesignation: string | null
  isActive: boolean
  lastLogin: string | null
  college: { id: number; name: string } | null
  department: { id: number; name: string } | null
  createdAt: string | null
  updatedAt: string | null
  deletedAt: string | null
}

export interface UserCreateInput {
  username: string
  email: string
  password: string
  firstName?: string
  middleName?: string
  lastName?: string
  role: number
  employeeId?: string
  position?: string
  address?: string
  otherDesignation?: string
  collegeId?: number
  departmentId?: number
}

export interface UserUpdateInput extends Partial<Omit<UserCreateInput, 'password'>> {
  password?: string
}
