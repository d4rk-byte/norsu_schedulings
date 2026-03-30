import api from './api'
import type {
  ApiResponse,
  ApiListResponse,
  User,
  UserCreateInput,
  UserUpdateInput,
  Department,
  Room,
  RoomInput,
  Schedule,
  ScheduleInput,
  ConflictCheckResult,
  Curriculum,
  AcademicYear,
  Subject,
  ScheduleChangeRequest,
} from '@/types'

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  [key: string]: unknown
}

export interface DhScheduleChangeRequestListParams {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all'
  department_head_status?: 'pending' | 'approved' | 'rejected' | 'all'
  limit?: number
}

export interface DhScheduleChangeRequestReviewPayload {
  comment?: string
}

export interface DhScheduleChangeRequestReviewResult {
  success: boolean
  message?: string
  data: ScheduleChangeRequest
}

// ---- Dashboard ----
export interface DeptHeadDashboardStats {
  totalFaculty: number
  activeFaculty: number
  inactiveFaculty: number
  totalSchedules: number
  totalCurricula: number
  totalRooms: number
  schedulesByStatus: { active: number; inactive: number; draft: number }
  facultyWorkloads: {
    id: number
    name: string
    units: number
    percentage: number
    status: string
  }[]
  recentActivities: {
    id: number
    type: string
    description: string
    timestamp: string
  }[]
  conflicts: number
  roomUtilization: number
}

export const dhDashboard = {
  stats: (p?: { academic_year_id?: string; semester?: string }) =>
    api.get<ApiResponse<DeptHeadDashboardStats>>('/api/department-head/dashboard', { params: p }).then(r => r.data.data),
}

// ---- Department Info ----
export const dhDepartmentInfo = {
  get: () => api.get<ApiResponse<Department>>('/api/department-head/department-info').then(r => r.data.data),
}

// ---- Faculty ----
export const dhFacultyApi = {
  list:       (p?: ListParams) => api.get<ApiListResponse<User>>('/api/department-head/faculty', { params: p }).then(r => r.data),
  get:        (id: number) => api.get<ApiResponse<User>>(`/api/department-head/faculty/${id}`).then(r => r.data.data),
  create:     (d: UserCreateInput) => api.post<ApiResponse<User>>('/api/department-head/faculty', d).then(r => r.data.data),
  update:     (id: number, d: UserUpdateInput) => api.put<ApiResponse<User>>(`/api/department-head/faculty/${id}`, d).then(r => r.data.data),
  delete:     (id: number) => api.delete(`/api/department-head/faculty/${id}`),
  activate:   (id: number) => api.post(`/api/department-head/faculty/${id}/activate`),
  deactivate: (id: number) => api.post(`/api/department-head/faculty/${id}/deactivate`),
  generatePassword: () => api.post<ApiResponse<{ password: string }>>('/api/department-head/faculty/generate-password').then(r => r.data.data),
  checkAvailability: (field: string, value: string) => api.post<ApiResponse<{ available: boolean; message?: string }>>('/api/department-head/faculty/check-availability', { [field]: value }).then(r => r.data.data),
}

// ---- Schedules ----
export const dhSchedulesApi = {
  list:          (p?: ListParams) => api.get<ApiListResponse<Schedule>>('/api/department-head/schedules', { params: p }).then(r => r.data),
  get:           (id: number) => api.get<ApiResponse<Schedule>>(`/api/department-head/schedules/${id}`).then(r => r.data.data),
  create:        (d: ScheduleInput) => api.post<ApiResponse<Schedule>>('/api/department-head/schedules', d).then(r => r.data),
  update:        (id: number, d: Partial<ScheduleInput>) => api.put<ApiResponse<Schedule>>(`/api/department-head/schedules/${id}`, d).then(r => r.data),
  checkConflict: (d: Partial<ScheduleInput> & { excludeId?: number }) => api.post<ApiResponse<ConflictCheckResult>>('/api/department-head/schedules/check-conflict', d).then(r => r.data.data),
  assignFaculty: (id: number, payload: { facultyId: number | null }) => api.post<ApiResponse<Schedule>>(`/api/department-head/schedules/${id}/assign-faculty`, payload).then(r => r.data.data),
  toggleOverload: (id: number) => api.post<ApiResponse<{ schedule: Schedule; isOverload: boolean }>>(`/api/department-head/schedules/${id}/toggle-overload`).then(r => r.data.data),
}

export const dhScheduleChangeRequestsApi = {
  list: (p?: DhScheduleChangeRequestListParams) =>
    api
      .get<ApiResponse<ScheduleChangeRequest[]>>('/api/department-head/schedule-change-requests', { params: p })
      .then(r => r.data.data),
  get: (id: number) =>
    api
      .get<ApiResponse<ScheduleChangeRequest>>(`/api/department-head/schedule-change-requests/${id}`)
      .then(r => r.data.data),
  approve: (id: number, payload?: DhScheduleChangeRequestReviewPayload) =>
    api
      .post<DhScheduleChangeRequestReviewResult>(`/api/department-head/schedule-change-requests/${id}/approve`, payload ?? {})
      .then(r => r.data),
  reject: (id: number, payload?: DhScheduleChangeRequestReviewPayload) =>
    api
      .post<DhScheduleChangeRequestReviewResult>(`/api/department-head/schedule-change-requests/${id}/reject`, payload ?? {})
      .then(r => r.data),
}

// ---- Rooms ----
export const dhRoomsApi = {
  list:       (p?: ListParams) => api.get<ApiListResponse<Room>>('/api/department-head/rooms', { params: p }).then(r => r.data),
  get:        (id: number) => api.get<ApiResponse<Room>>(`/api/department-head/rooms/${id}`).then(r => r.data.data),
  create:     (d: Omit<RoomInput, 'departmentId'>) => api.post<ApiResponse<Room>>('/api/department-head/rooms', d).then(r => r.data.data),
  update:     (id: number, d: Partial<Omit<RoomInput, 'departmentId'>>) => api.put<ApiResponse<Room>>(`/api/department-head/rooms/${id}`, d).then(r => r.data.data),
  activate:   (id: number) => api.post(`/api/department-head/rooms/${id}/activate`),
  deactivate: (id: number) => api.post(`/api/department-head/rooms/${id}/deactivate`),
  schedulePdf: (id: number, p?: { academic_year?: string; semester?: string }) =>
    api.get(`/api/department-head/rooms/${id}/schedule-pdf`, {
      params: p,
      responseType: 'blob',
    }).then(r => r.data as Blob),
}

// ---- Curricula ----
export const dhCurriculaApi = {
  list:      (p?: ListParams) => api.get<ApiListResponse<Curriculum>>('/api/department-head/curricula', { params: p }).then(r => r.data),
  get:       (id: number) => api.get<ApiResponse<Curriculum>>(`/api/department-head/curricula/${id}`).then(r => r.data.data),
  publish:   (id: number) => api.post(`/api/department-head/curricula/${id}/publish`),
  unpublish: (id: number) => api.post(`/api/department-head/curricula/${id}/unpublish`),
  downloadTemplate: () => api.get<ApiResponse<{ content: string; filename: string }>>('/api/department-head/curricula/template/download').then(r => r.data.data),
  bulkUpload: (file: File, name: string, version: number, autoCreateTerms = true) => {
    const fd = new FormData()
    fd.append('curriculum_file', file)
    fd.append('curriculum_name', name)
    fd.append('version', String(version))
    fd.append('auto_create_terms', autoCreateTerms ? '1' : '0')
    return api.post<ApiResponse<Curriculum> & { subjects_added?: number; terms_created?: number; errors?: string[] }>('/api/department-head/curricula/bulk-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
}

// ---- Faculty Assignments ----
export interface FacultyAssignment {
  faculty: {
    id: number
    fullName: string
    employeeId: string | null
    position: string | null
    department?: { id: number; code: string; name: string } | null
  }
  schedules: Schedule[]
  totalUnits: number
  totalHours: number
}

export const dhFacultyAssignmentsApi = {
  list: (p?: ListParams) => api.get('/api/department-head/faculty-assignments', { params: p }).then(r => r.data) as any,
}

// ---- Profile ----
export interface DhProfileData {
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
}

export interface DhProfileUpdateInput {
  first_name?: string
  middle_name?: string
  last_name?: string
  address?: string
  other_designation?: string
}

export const dhProfileApi = {
  get:    () => api.get<DhProfileData>('/api/department-head/profile').then(r => r.data),
  update: (data: DhProfileUpdateInput) => api.put<{ success: boolean; message: string }>('/api/department-head/profile', data).then(r => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.put<{ success: boolean; message: string }>('/api/department-head/profile/change-password', data).then(r => r.data),
}

// ---- Reports ----
export const dhReportsApi = {
  facultyWorkload:  (p?: ListParams) => api.get('/api/department-head/reports/faculty-workload', { params: p }).then(r => r.data.data),
  roomUtilization:  (p?: ListParams) => api.get('/api/department-head/reports/room-utilization', { params: p }).then(r => r.data.data),
  exportPdf:        (type: string, p?: Record<string, unknown>) => api.get(`/api/department-head/reports/${type}/pdf`, { params: p, responseType: 'blob' }).then(r => r.data),
  teachingLoadPdf:  (facultyId: number) => api.get('/api/department-head/reports/teaching-load/pdf', {
    params: { facultyId },
    responseType: 'blob'
  }).then(r => r.data),
}

// ---- Settings ----
export const dhSettingsApi = {
  get:    () => api.get<ApiResponse<Record<string, unknown>>>('/api/department-head/settings').then(r => r.data.data),
  update: (d: Record<string, unknown>) => api.put<ApiResponse<Record<string, unknown>>>('/api/department-head/settings', d).then(r => r.data.data),
}

// ---- Lookup helpers (for form dropdowns, scoped to department) ----
export const dhLookupsApi = {
  academicYears: () => api.get<ApiListResponse<AcademicYear>>('/api/department-head/academic-years', { params: { limit: 100 } }).then(r => r.data),
  subjects:      (p?: { semester?: string }) => api.get<ApiListResponse<Subject>>('/api/department-head/subjects', { params: { limit: 200, ...p } }).then(r => r.data),
  rooms:         () => api.get<ApiListResponse<Room>>('/api/department-head/rooms', { params: { limit: 200 } }).then(r => r.data),
  faculty:       () => api.get<ApiListResponse<User>>('/api/department-head/faculty', { params: { limit: 200, is_active: true } }).then(r => r.data),
}

// ---- Activity Logs (scoped to department) ----
export interface ActivityLog {
  id: number
  action: string
  description: string
  entityType: string | null
  entityId: number | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  user: { id: number; fullName: string } | null
}

export const dhActivityLogsApi = {
  list: (p?: ListParams) => api.get<ApiListResponse<ActivityLog>>('/api/department-head/activity-logs', { params: p }).then(r => r.data),
}
