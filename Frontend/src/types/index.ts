export type { ApiResponse, ApiListResponse, PaginationMeta, ApiError } from './api'
export type { User, UserCreateInput, UserUpdateInput } from './user'
export type { College, CollegeInput } from './college'
export type { Department, DepartmentInput } from './department'
export type { Subject, SubjectInput } from './subject'
export type { Room, RoomInput } from './room'
export type { Schedule, ScheduleInput, ConflictCheckResult } from './schedule'
export type { ScheduleChangeRequest } from './schedule-change-request'
export type { AcademicYear, AcademicYearInput } from './academic-year'
export type { Curriculum, CurriculumTerm, CurriculumSubject, CurriculumInput, CurriculumTermInput } from './curriculum'
export type { Notification } from './notification'

import type { AcademicYear } from './academic-year'
import type { Schedule } from './schedule'

// Activity log (used in admin)
export interface ActivityLog {
  id: number
  action: string
  description: string
  entityType: string | null
  entityId: number | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: number
    fullName: string
    role?: number | null
    roleDisplayName?: string | null
  } | null
}

// Department group
export interface DepartmentGroup {
  id: number
  name: string
  description: string | null
  color: string | null
  departments: { id: number; name: string }[]
  createdAt: string
  updatedAt: string
}

export interface DepartmentGroupInput {
  name: string
  description?: string
  color?: string
  departmentIds?: number[]
}

// Dashboard stats (admin)
export interface AdminDashboardStats {
  totalUsers: number
  totalFaculty: number
  totalDepartmentHeads: number
  totalAdmins: number
  activeUsers: number
  totalColleges: number
  totalDepartments: number
  totalSubjects: number
  totalRooms: number
  availableRooms: number
  totalSchedules: number
  totalCurriculums: number
  activeCurriculums: number
  growthPercent: number
  thisMonthUsers: number
  currentAcademicYear: AcademicYear | null
  recentActivities: ActivityLog[]
}

// Faculty dashboard
export interface FacultyDashboardStats {
  totalHours: number
  activeClasses: number
  totalStudents: number
  todayCount: number
  currentAcademicYear: {
    year: string
    semester: string
  } | null
  todaySchedules: Schedule[]
}
