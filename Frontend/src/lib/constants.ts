// Role integer values (matches Symfony User entity)
export const ROLES = {
  ADMIN: 1,
  DEPARTMENT_HEAD: 2,
  FACULTY: 3,
} as const

// Role string mappings
export const ROLE_LABELS: Record<number, string> = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.DEPARTMENT_HEAD]: 'Department Head',
  [ROLES.FACULTY]: 'Faculty',
}

// Role-based dashboard routes
export const ROLE_DASHBOARDS: Record<number, string> = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.DEPARTMENT_HEAD]: '/department-head/dashboard',
  [ROLES.FACULTY]: '/faculty/dashboard',
}

// Role-based profile routes
export const ROLE_PROFILE_PATHS: Record<number, string> = {
  [ROLES.ADMIN]: '/admin/profile',
  [ROLES.DEPARTMENT_HEAD]: '/department-head/profile',
  [ROLES.FACULTY]: '/faculty/profile',
}

// Faculty/admin position options for user forms
export const POSITION_OPTIONS = [
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Contractual', label: 'Contractual' },
  { value: 'Visiting', label: 'Visiting' },
  { value: 'Temporary', label: 'Temporary' },
] as const

// Semester options
export const SEMESTERS = ['1st', '2nd', 'Summer'] as const

// Day pattern options
export const DAY_PATTERNS = [
  { value: 'M-W-F', label: 'Monday-Wednesday-Friday' },
  { value: 'T-TH', label: 'Tuesday-Thursday' },
  { value: 'M-T-TH-F', label: 'Mon-Tue-Thu-Fri' },
  { value: 'M-T', label: 'Monday-Tuesday' },
  { value: 'TH-F', label: 'Thursday-Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
] as const

// Room types
export const ROOM_TYPES = ['classroom', 'laboratory', 'auditorium', 'office'] as const

// Subject types
export const SUBJECT_TYPES = ['lecture', 'laboratory', 'lecture-lab'] as const

// Schedule statuses
export const SCHEDULE_STATUSES = ['active', 'inactive', 'draft'] as const

// Notification types
export const NOTIFICATION_TYPES = {
  SCHEDULE_ASSIGNED: 'schedule_assigned',
  SCHEDULE_UPDATED: 'schedule_updated',
  SCHEDULE_REMOVED: 'schedule_removed',
  SCHEDULE_ACTIVATED: 'schedule_activated',
  SCHEDULE_DEACTIVATED: 'schedule_deactivated',
  ANNOUNCEMENT: 'announcement',
  SYSTEM: 'system',
} as const

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20

// Time slots (90-minute intervals from 7:00 AM to 8:30 PM)
export const TIME_SLOTS = [
  { start: '07:00', end: '08:30', label: '7:00 AM – 8:30 AM' },
  { start: '08:30', end: '10:00', label: '8:30 AM – 10:00 AM' },
  { start: '10:00', end: '11:30', label: '10:00 AM – 11:30 AM' },
  { start: '11:30', end: '13:00', label: '11:30 AM – 1:00 PM' },
  { start: '13:00', end: '14:30', label: '1:00 PM – 2:30 PM' },
  { start: '14:30', end: '16:00', label: '2:30 PM – 4:00 PM' },
  { start: '16:00', end: '17:30', label: '4:00 PM – 5:30 PM' },
  { start: '17:30', end: '19:00', label: '5:30 PM – 7:00 PM' },
  { start: '19:00', end: '20:30', label: '7:00 PM – 8:30 PM' },
] as const
