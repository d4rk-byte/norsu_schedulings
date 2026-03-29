import type { Schedule } from './schedule'

export interface ScheduleChangeRequestUserSummary {
  id: number
  fullName: string
  email: string
  role: string
  department: {
    id: number
    code: string
    name: string
  } | null
}

export interface ScheduleChangeRequestRoomSummary {
  id: number
  code: string
  name: string | null
  building: string | null
  floor: string | null
  capacity: number | null
}

export interface ScheduleChangeRequestDepartmentSummary {
  id: number
  code: string | null
  name: string
}

export interface ScheduleChangeRequestProposal {
  dayPattern: string | null
  startTime: string | null
  endTime: string | null
  section: string | null
  room: ScheduleChangeRequestRoomSummary | null
}

export interface ScheduleChangeRequest {
  id: number
  status: string
  adminStatus: string
  departmentHeadStatus: string
  requestReason: string | null
  adminComment: string | null
  departmentHeadComment: string | null
  submittedAt: string | null
  adminReviewedAt: string | null
  departmentHeadReviewedAt: string | null
  cancelledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  requester: ScheduleChangeRequestUserSummary | null
  subjectDepartment: ScheduleChangeRequestDepartmentSummary | null
  schedule: Schedule | null
  proposal: ScheduleChangeRequestProposal
  approvers: {
    admin: ScheduleChangeRequestUserSummary | null
    departmentHead: ScheduleChangeRequestUserSummary | null
  }
  reviewers: {
    admin: ScheduleChangeRequestUserSummary | null
    departmentHead: ScheduleChangeRequestUserSummary | null
  }
  requestedChanges: Record<string, unknown> | null
  conflictSnapshot: unknown
  canAdminReview?: boolean
  canDepartmentHeadReview?: boolean
}
