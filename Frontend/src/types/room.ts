export interface Room {
  id: number
  code: string
  name: string | null
  type: string | null
  capacity: number | null
  building: string | null
  floor: string | null
  equipment: string | null
  isActive: boolean
  department: { id: number; name: string }
  departmentGroup: { id: number; name: string } | null
  createdAt: string | null
  updatedAt: string | null
}

export interface RoomInput {
  code: string
  name?: string
  type?: string
  capacity?: number
  building?: string
  floor?: string
  equipment?: string
  departmentId: number
  departmentGroupId?: number
}
