import api from './api'
import type { Notification } from '@/types'
import type { ConflictCheckResult, ScheduleInput } from '@/types'

async function openPdfPreview(
  endpoint: string,
  params: Record<string, unknown>,
  fallbackFilename: string,
): Promise<void> {
  const previewWindow = window.open('', '_blank')

  if (previewWindow) {
    previewWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 16px;">Loading PDF preview...</p>')
    previewWindow.document.close()
  }

  const res = await api.get(endpoint, {
    params,
    responseType: 'blob',
  })

  const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))

  if (previewWindow) {
    previewWindow.location.href = blobUrl
  } else {
    const opened = window.open(blobUrl, '_blank')

    if (!opened) {
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fallbackFilename
      a.click()
    }
  }

  window.setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl)
  }, 60000)
}

// ── Response shapes from the API ──────────────────────────

export interface FacultyDashboardResponse {
  today: string
  academic_year: { id: number; year: string; semester: string } | null
  today_schedules: FacultyScheduleItem[]
  stats: {
    total_hours: number
    active_classes: number
    total_students: number
    today_count: number
  }
}

export interface FacultyScheduleItem {
  id: number
  subject: { id: number; code: string; title: string; units: number; type: string | null }
  room: { id: number; name: string | null; code: string; building: string | null; floor: string | null; capacity: number | null }
  day_pattern: string
  day_pattern_label: string
  days: string[]
  start_time: string
  end_time: string
  start_time_12h: string
  end_time_12h: string
  section: string | null
  enrolled_students: number
  updated_at?: string | null
  semester: string
  academic_year: { id: number; year: string } | null
  status: string
}

export interface FacultyScheduleResponse {
  academic_year: { id: number; year: string } | null
  semester: string
  schedules: FacultyScheduleItem[]
  stats: {
    total_hours: number
    total_classes: number
    total_students: number
    total_rooms: number
  }
}

export interface FacultyWeeklyResponse {
  semester: string
  weekly: Record<string, FacultyScheduleItem[]>
}

export interface FacultyClassesResponse {
  academic_year: { id: number; year: string } | null
  semester: string
  classes: FacultyScheduleItem[]
  stats: {
    total_classes: number
    total_students: number
    teaching_hours: number
  }
}

export interface FacultyClassUpdateResponse {
  success: boolean
  message: string
  data: FacultyScheduleItem
}

export interface FacultyProfileData {
  id: number
  username: string
  email: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  full_name: string
  employee_id: string | null
  position: string | null
  address: string | null
  other_designation: string | null
  department: { id: number; name: string } | null
  college: { id: number; name: string } | null
  profile_complete?: boolean
  missing_profile_fields?: string[]
}

export interface FacultyProfileUpdateInput {
  first_name?: string
  middle_name?: string
  last_name?: string
  address?: string
  other_designation?: string
}

export interface FacultyProfileCompletionInput {
  first_name: string
  middle_name?: string
  last_name: string
  college_id: number
  department_id: number
  position: string
  other_designation?: string
  address?: string
}

export interface FacultyCompletionOptions {
  colleges: Array<{ id: number; code: string; name: string }>
  departments: Array<{ id: number; code: string; name: string; college_id: number | null }>
}

export interface FacultyChangePasswordInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface FacultyScheduleChangeRequestInput {
  schedule_id: number
  day_pattern: string
  start_time: string
  end_time: string
  room_id: number
  section?: string | null
  reason?: string
}

export interface FacultyScheduleChangeRoom {
  id: number
  code: string | null
  name: string | null
  building: string | null
  floor: string | null
}

export interface FacultyScheduleChangeApprover {
  id: number
  full_name: string
  email: string
  role: string
}

export interface FacultyScheduleChangeRequest {
  id: number
  status: string
  admin_status: string
  department_head_status: string
  request_reason: string | null
  submitted_at: string | null
  cancelled_at: string | null
  created_at: string | null
  updated_at: string | null
  schedule: FacultyScheduleItem | null
  subject_department: {
    id: number
    code: string | null
    name: string | null
  } | null
  approvers: {
    admin: FacultyScheduleChangeApprover | null
    department_head: FacultyScheduleChangeApprover | null
  }
  proposal: {
    day_pattern: string | null
    start_time: string | null
    end_time: string | null
    section: string | null
    room: FacultyScheduleChangeRoom | null
  }
  requested_changes: Record<string, unknown> | null
  conflict_snapshot: unknown
  can_cancel: boolean
}

export interface FacultyScheduleChangeListParams {
  status?: string
  limit?: number
}

export interface FacultyRoomsListParams {
  limit?: number
  search?: string
}

export interface FacultyScheduleChangeActionResponse {
  success: boolean
  message?: string
  data: FacultyScheduleChangeRequest
}

export interface FacultyScheduleChangeConflictCheckInput {
  schedule_id: number
  day_pattern: string
  start_time: string
  end_time: string
  room_id: number
  section?: string | null
}

// ── API Methods ──────────────────────────────────────────

export const facultyApi = {
  // Dashboard
  dashboard: () =>
    api.get<FacultyDashboardResponse>('/api/faculty/dashboard').then(r => r.data),

  // Schedule
  schedule: (semester?: string) =>
    api.get<FacultyScheduleResponse>('/api/faculty/schedule', { params: semester ? { semester } : {} }).then(r => r.data),

  scheduleWeekly: (semester?: string) =>
    api.get<FacultyWeeklyResponse>('/api/faculty/schedule/weekly', { params: semester ? { semester } : {} }).then(r => r.data),

  exportSchedulePdf: async (semester?: string) => {
    await openPdfPreview(
      '/api/faculty/schedule/export-pdf',
      semester ? { semester } : {},
      'teaching-schedule.pdf',
    )
  },

  exportTeachingLoadPdf: async (semester?: string) => {
    await openPdfPreview(
      '/api/faculty/schedule/teaching-load-pdf',
      semester ? { semester } : {},
      'teaching-load.pdf',
    )
  },

  // Classes
  classes: (semester?: string) =>
    api.get<FacultyClassesResponse>('/api/faculty/classes', { params: semester ? { semester } : {} }).then(r => r.data),

  updateClassEnrolledStudents: (classId: number, enrolledStudents: number) =>
    api.patch<FacultyClassUpdateResponse>(`/api/faculty/classes/${classId}/enrolled-students`, {
      enrolled_students: enrolledStudents,
    }).then(r => r.data),

  // Profile
  getProfile: () =>
    api.get<FacultyProfileData>('/api/faculty/profile').then(r => r.data),

  getProfileCompletionOptions: () =>
    api.get<{ success: boolean; data: FacultyCompletionOptions }>('/api/faculty/profile/completion-options').then(r => r.data.data),

  completeProfile: (data: FacultyProfileCompletionInput) =>
    api.put<{ success: boolean; message: string }>('/api/faculty/profile/complete', data).then(r => r.data),

  updateProfile: (data: FacultyProfileUpdateInput) =>
    api.put<{ success: boolean; message: string }>('/api/faculty/profile', data).then(r => r.data),

  changePassword: (data: FacultyChangePasswordInput) =>
    api.put<{ success: boolean; message: string }>('/api/faculty/profile/change-password', data).then(r => r.data),

  // Schedule Change Requests
  listRooms: (params: FacultyRoomsListParams = {}) =>
    api.get<{ success: boolean; data: FacultyScheduleChangeRoom[] }>('/api/faculty/rooms', {
      params,
    }).then(r => r.data.data),

  listScheduleChangeRequests: (params: FacultyScheduleChangeListParams = {}) =>
    api.get<{ success: boolean; data: FacultyScheduleChangeRequest[] }>('/api/faculty/schedule-change-requests', {
      params,
    }).then(r => r.data.data),

  getScheduleChangeRequest: (id: number) =>
    api.get<{ success: boolean; data: FacultyScheduleChangeRequest }>(`/api/faculty/schedule-change-requests/${id}`).then(r => r.data.data),

  createScheduleChangeRequest: (payload: FacultyScheduleChangeRequestInput) =>
    api.post<FacultyScheduleChangeActionResponse>('/api/faculty/schedule-change-requests', payload).then(r => r.data),

  checkScheduleChangeConflict: (payload: FacultyScheduleChangeConflictCheckInput) =>
    api
      .post<{ success: boolean; data: ConflictCheckResult }>(
        '/api/faculty/schedule-change-requests/check-conflict',
        payload as Partial<ScheduleInput>,
      )
      .then(r => r.data.data),

  cancelScheduleChangeRequest: (id: number) =>
    api.post<FacultyScheduleChangeActionResponse>(`/api/faculty/schedule-change-requests/${id}/cancel`).then(r => r.data),

  // Notifications
  getNotifications: (limit = 20, offset = 0) =>
    api.get<{ notifications: Notification[]; unread_count: number }>('/api/faculty/notifications', {
      params: { limit, offset },
    }).then(r => r.data),

  getUnreadCount: () =>
    api.get<{ unread_count: number }>('/api/faculty/notifications/unread-count').then(r => r.data),

  markNotificationRead: (id: number) =>
    api.post<{ success: boolean }>(`/api/faculty/notifications/${id}/read`).then(r => r.data),

  markAllNotificationsRead: () =>
    api.post<{ success: boolean; updated: number }>('/api/faculty/notifications/read-all').then(r => r.data),

  deleteNotification: (id: number) =>
    api.delete<{ success: boolean }>(`/api/faculty/notifications/${id}`).then(r => r.data),
}
