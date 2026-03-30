export interface Schedule {
  id: number
  semester: string
  dayPattern: string | null
  dayPatternLabel: string
  startTime: string
  endTime: string
  section: string | null
  enrolledStudents: number
  isConflicted: boolean
  isOverload: boolean
  status: string
  notes: string | null
  academicYear: { id: number; year: string; isCurrent?: boolean }
  subject: {
    id: number
    code: string
    title: string
    units: number
    department?: { id: number; name: string } | null
  }
  room: { id: number; code: string; name: string | null }
  faculty: { id: number; fullName: string; employeeId: string | null } | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ScheduleInput {
  semester: string
  dayPattern: string
  startTime: string
  endTime: string
  section?: string
  enrolledStudents?: number
  status?: string
  notes?: string
  academicYearId: number
  subjectId: number
  roomId: number
  facultyId?: number | null
}

export interface ConflictCheckResult {
  hasConflict: boolean
  conflicts: {
    type: string
    message: string
    schedule?: Schedule
  }[]
}
