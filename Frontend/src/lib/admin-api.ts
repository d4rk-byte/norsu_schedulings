import api from './api'
import type {
  ApiResponse,
  ApiListResponse,
  College,
  CollegeInput,
  Department,
  DepartmentInput,
  Subject,
  SubjectInput,
  Room,
  RoomInput,
  User,
  UserCreateInput,
  UserUpdateInput,
  AcademicYear,
  AcademicYearInput,
  Curriculum,
  CurriculumInput,
  Schedule,
  ScheduleInput,
  ScheduleChangeRequest,
  ConflictCheckResult,
  ActivityLog,
  DepartmentGroup,
  DepartmentGroupInput,
  AdminDashboardStats,
} from '@/types'

// Query params shared by most list endpoints
export interface ListParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  [key: string]: unknown
}

export interface ScheduleChangeRequestListParams {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all'
  admin_status?: 'pending' | 'approved' | 'rejected' | 'all'
  limit?: number
}

export interface ScheduleChangeRequestReviewPayload {
  comment?: string
}

export interface ScheduleChangeRequestReviewResult {
  success: boolean
  message?: string
  data: ScheduleChangeRequest
}

// ---- Dashboard ----
export const adminDashboard = {
  stats: () => api.get<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard/stats').then(r => r.data.data),
}

// ---- Colleges ----
export const collegesApi = {
  stats:      () => api.get<ApiResponse<{ total: number; active: number; inactive: number; recent: number; total_faculty: number; active_faculty: number; total_departments: number; active_departments: number }>>('/api/admin/colleges/stats').then(r => r.data.data),
  list:       (p?: ListParams) => api.get<ApiListResponse<College>>('/api/admin/colleges', { params: p }).then(r => r.data),
  get:        (id: number)     => api.get<ApiResponse<College>>(`/api/admin/colleges/${id}`).then(r => r.data.data),
  create:     (d: CollegeInput) => api.post<ApiResponse<College>>('/api/admin/colleges', d).then(r => r.data.data),
  update:     (id: number, d: Partial<CollegeInput>) => api.put<ApiResponse<College>>(`/api/admin/colleges/${id}`, d).then(r => r.data.data),
  delete:     (id: number) => api.delete(`/api/admin/colleges/${id}`),
  activate:   (id: number) => api.post(`/api/admin/colleges/${id}/activate`),
  deactivate: (id: number) => api.post(`/api/admin/colleges/${id}/deactivate`),
  bulkAction: (action: string, ids: number[]) => api.post('/api/admin/colleges/bulk-action', { action, ids }),
  checkCode:  (code: string) => api.post<ApiResponse<{ available: boolean }>>('/api/admin/colleges/check-code', { code }).then(r => r.data.data),
}

// ---- Departments ----
export const departmentsApi = {
  stats:        () => api.get<ApiResponse<{ total: number; active: number; inactive: number; recent: number; with_head: number; without_head: number; total_faculty: number }>>('/api/admin/departments/stats').then(r => r.data.data),
  list:         (p?: ListParams) => api.get<ApiListResponse<Department>>('/api/admin/departments', { params: p }).then(r => r.data),
  get:          (id: number) => api.get<ApiResponse<Department>>(`/api/admin/departments/${id}`).then(r => r.data.data),
  create:       (d: DepartmentInput) => api.post<ApiResponse<Department>>('/api/admin/departments', d).then(r => r.data.data),
  update:       (id: number, d: Partial<DepartmentInput>) => api.put<ApiResponse<Department>>(`/api/admin/departments/${id}`, d).then(r => r.data.data),
  delete:       (id: number) => api.delete(`/api/admin/departments/${id}`),
  toggleStatus: (id: number) => api.post(`/api/admin/departments/${id}/toggle-status`),
}

// ---- Subjects ----
export const subjectsApi = {
  list:   (p?: ListParams) => api.get<ApiListResponse<Subject>>('/api/admin/subjects', { params: p }).then(r => r.data),
  get:    (id: number) => api.get<ApiResponse<Subject>>(`/api/admin/subjects/${id}`).then(r => r.data.data),
  create: (d: SubjectInput) => api.post<ApiResponse<Subject>>('/api/admin/subjects', d).then(r => r.data.data),
  update: (id: number, d: Partial<SubjectInput>) => api.put<ApiResponse<Subject>>(`/api/admin/subjects/${id}`, d).then(r => r.data.data),
  delete: (id: number) => api.delete(`/api/admin/subjects/${id}`),
}

// ---- Rooms ----
export const roomsApi = {
  stats:   () => api.get<ApiResponse<{ total: number; active: number; inactive: number; recent: number; total_capacity: number; building_counts: Record<string, number> }>>('/api/admin/rooms/stats').then(r => r.data.data),
  list:    (p?: ListParams) => api.get<ApiListResponse<Room>>('/api/admin/rooms', { params: p }).then(r => r.data),
  get:     (id: number) => api.get<ApiResponse<Room>>(`/api/admin/rooms/${id}`).then(r => r.data.data),
  create:  (d: RoomInput) => api.post<ApiResponse<Room>>('/api/admin/rooms', d).then(r => r.data.data),
  update:  (id: number, d: Partial<RoomInput>) => api.put<ApiResponse<Room>>(`/api/admin/rooms/${id}`, d).then(r => r.data.data),
  delete:  (id: number) => api.delete(`/api/admin/rooms/${id}`),
  history: (id: number, p?: ListParams) => api.get<ApiListResponse<Schedule>>(`/api/admin/rooms/${id}/history`, { params: p }).then(r => r.data),
  schedulePdf: (id: number, p?: { academic_year?: string; semester?: string }) => api.get(`/api/admin/rooms/${id}/schedule-pdf`, { params: p, responseType: 'blob' }).then(r => r.data as Blob),
}

// ---- Users ----
export const usersApi = {
  list:       (p?: ListParams) => api.get<ApiListResponse<User>>('/api/admin/users', { params: p }).then(r => r.data),
  get:        (id: number) => api.get<ApiResponse<User>>(`/api/admin/users/${id}`).then(r => r.data.data),
  create:     (d: UserCreateInput) => api.post<ApiResponse<User>>('/api/admin/users', d).then(r => r.data.data),
  update:     (id: number, d: UserUpdateInput) => api.put<ApiResponse<User>>(`/api/admin/users/${id}`, d).then(r => r.data.data),
  checkAvailability: (field: 'username' | 'email' | 'employeeId', value: string, excludeUserId?: number) =>
    api.post<ApiResponse<{ available: boolean; message?: string }>>('/api/admin/users/check-availability', {
      [field]: value,
      ...(excludeUserId ? { excludeUserId } : {}),
    }).then(r => r.data.data),
  delete:     (id: number) => api.delete(`/api/admin/users/${id}`),
  restore:    (id: number) => api.post(`/api/admin/users/${id}/restore`),
  deletePermanently: (id: number) => api.delete(`/api/admin/users/${id}/permanent-delete`),
  activate:   (id: number) => api.post(`/api/admin/users/${id}/activate`),
  deactivate: (id: number) => api.post(`/api/admin/users/${id}/deactivate`),
}

// ---- Academic Years ----
export const academicYearsApi = {
  stats:        () => api.get<ApiResponse<{ total: number; active: number; inactive: number; current: number }>>('/api/admin/academic-years/stats').then(r => r.data.data),
  list:         (p?: ListParams) => api.get<ApiListResponse<AcademicYear>>('/api/admin/academic-years', { params: p }).then(r => r.data),
  get:          (id: number) => api.get<ApiResponse<AcademicYear>>(`/api/admin/academic-years/${id}`).then(r => r.data.data),
  create:       (d: AcademicYearInput) => api.post<ApiResponse<AcademicYear>>('/api/admin/academic-years', d).then(r => r.data.data),
  update:       (id: number, d: Partial<AcademicYearInput>) => api.put<ApiResponse<AcademicYear>>(`/api/admin/academic-years/${id}`, d).then(r => r.data.data),
  delete:       (id: number) => api.delete(`/api/admin/academic-years/${id}`),
  setCurrent:   (id: number, semester?: string) => api.post(`/api/admin/academic-years/${id}/set-current`, semester ? { semester } : {}),
  toggleStatus: (id: number) => api.post(`/api/admin/academic-years/${id}/toggle-status`),
  setSemester:  (id: number, semester: string) => api.post(`/api/admin/academic-years/${id}/set-semester`, { semester }),
}

// ---- Curricula ----
export const curriculaApi = {
  stats:   () => api.get<ApiResponse<{ statistics: { total: number; published: number; draft: number; departments: number }; departments: { id: number; name: string; code: string; college: { id: number; name: string; code: string } | null; curricula: { total: number; published: number; draft: number } }[] }>>('/api/admin/curricula/stats').then(r => r.data.data),
  list:    (p?: ListParams) => api.get<ApiListResponse<Curriculum>>('/api/admin/curricula', { params: p }).then(r => r.data),
  get:     (id: number) => api.get<ApiResponse<Curriculum>>(`/api/admin/curricula/${id}`).then(r => r.data.data),
  create:  (d: CurriculumInput) => api.post<ApiResponse<Curriculum>>('/api/admin/curricula', d).then(r => r.data.data),
  update:  (id: number, d: Partial<CurriculumInput>) => api.put<ApiResponse<Curriculum>>(`/api/admin/curricula/${id}`, d).then(r => r.data.data),
  delete:  (id: number) => api.delete(`/api/admin/curricula/${id}`),
  publish: (id: number) => api.post(`/api/admin/curricula/${id}/publish`),
  // Term management
  generateTerms:  (id: number, years?: number) => api.post<ApiResponse<Curriculum>>(`/api/admin/curricula/${id}/terms/generate`, { years: years ?? 4 }).then(r => r.data.data),
  addTerm:        (id: number, data: { yearLevel: number; semester: string; termName?: string }) => api.post<ApiResponse<Curriculum>>(`/api/admin/curricula/${id}/terms`, data).then(r => r.data.data),
  deleteTerm:     (termId: number) => api.delete<ApiResponse<Curriculum>>(`/api/admin/curricula/terms/${termId}`).then(r => r.data.data),
  // Subject management
  addSubjectToTerm:     (termId: number, subjectId: number) => api.post<ApiResponse<Curriculum>>(`/api/admin/curricula/terms/${termId}/subjects`, { subjectId }).then(r => r.data.data),
  removeSubjectFromTerm: (csId: number) => api.delete<ApiResponse<Curriculum>>(`/api/admin/curricula/subjects/${csId}`).then(r => r.data.data),
  getAvailableSubjects:  (id: number, search?: string) => api.get<ApiResponse<{ id: number; code: string; title: string; units: number; type: string }[]>>(`/api/admin/curricula/${id}/available-subjects`, { params: { search } }).then(r => r.data.data),
  // Upload
  downloadTemplate: () => api.get<ApiResponse<{ content: string; filename: string }>>('/api/admin/curricula/template/download').then(r => r.data.data),
  uploadSubjects:   (id: number, file: File, autoCreateTerms = true) => {
    const fd = new FormData()
    fd.append('curriculum_file', file)
    fd.append('auto_create_terms', autoCreateTerms ? '1' : '0')
    return api.post<ApiResponse<Curriculum> & { subjects_added?: number; terms_created?: number; errors?: string[] }>(`/api/admin/curricula/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  bulkUpload: (file: File, name: string, version: number, departmentId: number, autoCreateTerms = true) => {
    const fd = new FormData()
    fd.append('curriculum_file', file)
    fd.append('curriculum_name', name)
    fd.append('version', String(version))
    fd.append('department_id', String(departmentId))
    fd.append('auto_create_terms', autoCreateTerms ? '1' : '0')
    return api.post<ApiResponse<Curriculum> & { subjects_added?: number; terms_created?: number; errors?: string[] }>('/api/admin/curricula/bulk-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
}

// ---- Schedules ----
export const schedulesApi = {
  list:          (p?: ListParams) => api.get<ApiListResponse<Schedule>>('/api/admin/schedules', { params: p }).then(r => r.data),
  get:           (id: number) => api.get<ApiResponse<Schedule>>(`/api/admin/schedules/${id}`).then(r => r.data.data),
  create:        (d: ScheduleInput) => api.post<ApiResponse<Schedule>>('/api/admin/schedules', d).then(r => r.data),
  update:        (id: number, d: Partial<ScheduleInput>) => api.put<ApiResponse<Schedule>>(`/api/admin/schedules/${id}`, d).then(r => r.data),
  delete:        (id: number) => api.delete(`/api/admin/schedules/${id}`),
  checkConflict: (d: Partial<ScheduleInput> & { excludeId?: number }) => api.post<ApiResponse<ConflictCheckResult>>('/api/admin/schedules/check-conflict', d).then(r => r.data.data),
  scanConflicts: (departmentId?: number) => api.post('/api/admin/schedules/scan-conflicts', departmentId ? { departmentId } : {}).then(r => r.data),
  assignFaculty: (id: number, payload: { facultyId: number | null; departmentId: number; includeGroup?: boolean }) => api.post<ApiResponse<Schedule>>(`/api/admin/schedules/${id}/assign-faculty`, payload).then(r => r.data),
  toggleOverload: (id: number) => api.post<ApiResponse<{ schedule: Schedule; isOverload: boolean }>>(`/api/admin/schedules/${id}/toggle-overload`).then(r => r.data.data),
  facultyLoading:(p?: ListParams) => api.get<ApiListResponse<{ id: number; fullName: string; employeeId: string | null; department: string | null; position: string | null; isActive: boolean; createdAt: string | null; assignedCount: number; totalHours: number; totalUnits: number; scheduleCount: number; isOverloaded: boolean }>>('/api/admin/schedules/faculty-loading', { params: p }).then(r => r.data),
}

export const adminScheduleChangeRequestsApi = {
  list: (p?: ScheduleChangeRequestListParams) =>
    api
      .get<ApiResponse<ScheduleChangeRequest[]>>('/api/admin/schedule-change-requests', { params: p })
      .then(r => r.data.data),
  get: (id: number) =>
    api
      .get<ApiResponse<ScheduleChangeRequest>>(`/api/admin/schedule-change-requests/${id}`)
      .then(r => r.data.data),
  approve: (id: number, payload?: ScheduleChangeRequestReviewPayload) =>
    api
      .post<ScheduleChangeRequestReviewResult>(`/api/admin/schedule-change-requests/${id}/approve`, payload ?? {})
      .then(r => r.data),
  reject: (id: number, payload?: ScheduleChangeRequestReviewPayload) =>
    api
      .post<ScheduleChangeRequestReviewResult>(`/api/admin/schedule-change-requests/${id}/reject`, payload ?? {})
      .then(r => r.data),
}

// ---- Department Groups ----
export const departmentGroupsApi = {
  stats:  () => api.get<ApiResponse<{ total_groups: number; grouped_departments: number; ungrouped_departments: number }>>('/api/admin/department-groups/stats').then(r => r.data.data),
  list:   (p?: ListParams) => api.get<ApiListResponse<DepartmentGroup>>('/api/admin/department-groups', { params: p }).then(r => r.data),
  get:    (id: number) => api.get<ApiResponse<DepartmentGroup>>(`/api/admin/department-groups/${id}`).then(r => r.data.data),
  create: (d: DepartmentGroupInput) => api.post<ApiResponse<DepartmentGroup>>('/api/admin/department-groups', d).then(r => r.data.data),
  update: (id: number, d: Partial<DepartmentGroupInput>) => api.put<ApiResponse<DepartmentGroup>>(`/api/admin/department-groups/${id}`, d).then(r => r.data.data),
  delete: (id: number) => api.delete(`/api/admin/department-groups/${id}`),
}

// ---- Profile ----
export interface ProfileData {
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

export interface ProfileUpdateInput {
  first_name?: string
  middle_name?: string
  last_name?: string
  address?: string
  other_designation?: string
}

export const adminProfileApi = {
  get:    () => api.get<ProfileData>('/api/admin/profile').then(r => r.data),
  update: (data: ProfileUpdateInput) => api.put<{ success: boolean; message: string }>('/api/admin/profile', data).then(r => r.data),
}

// ---- Activity Logs ----
export const activityLogsApi = {
  list: (p?: ListParams) => api.get<ApiListResponse<ActivityLog>>('/api/admin/activity-logs', { params: p }).then(r => r.data),
}

// ---- Reports ----
export const reportsApi = {
  facultyWorkload:  (p?: ListParams) => api.get('/api/admin/reports/faculty-workload', { params: p }).then(r => r.data),
  roomUtilization:  (p?: ListParams) => api.get('/api/admin/reports/room-utilization', { params: p }).then(r => r.data),
  subjectOfferings: (p?: ListParams) => api.get('/api/admin/reports/subject-offerings', { params: p }).then(r => r.data),
  exportPdf:        (type: string, p?: Record<string, unknown>) => api.get(`/api/admin/reports/${type}/pdf`, { params: p, responseType: 'blob' }).then(r => r.data),
  teachingLoadPdf:  (facultyId: number, semester?: string) => api.get('/api/admin/reports/teaching-load/pdf', {
    params: {
      facultyId,
      ...(semester ? { semester } : {}),
    },
    responseType: 'blob',
  }).then(r => r.data as Blob),
}

// ---- Settings ----
export const settingsApi = {
  get:    () => api.get<ApiResponse<Record<string, unknown>>>('/api/admin/settings').then(r => r.data.data),
  update: (d: Record<string, unknown>) => api.put<ApiResponse<Record<string, unknown>>>('/api/admin/settings', d).then(r => r.data.data),
}
