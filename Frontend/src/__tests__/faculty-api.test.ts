import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'

// ─── Mock axios ───────────────────────────────────────────
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

// Import after mocking
import { facultyApi } from '@/lib/faculty-api'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('facultyApi.dashboard', () => {
  it('calls GET /faculty/dashboard and returns data', async () => {
    const mockData = {
      today: 'Monday',
      academic_year: { id: 1, year: '2025-2026', semester: '1st' },
      today_schedules: [],
      stats: { total_hours: 18, active_classes: 5, total_students: 120, today_count: 3 },
    }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const result = await facultyApi.dashboard()
    expect(mockGet).toHaveBeenCalledWith('/faculty/dashboard')
    expect(result).toEqual(mockData)
  })
})

describe('facultyApi.schedule', () => {
  it('calls GET /faculty/schedule without semester param', async () => {
    const mockData = { schedules: [], stats: {}, semester: '1st', academic_year: null }
    mockGet.mockResolvedValueOnce({ data: mockData })

    await facultyApi.schedule()
    expect(mockGet).toHaveBeenCalledWith('/faculty/schedule', { params: {} })
  })

  it('calls GET /faculty/schedule with semester param', async () => {
    const mockData = { schedules: [], stats: {}, semester: '2nd', academic_year: null }
    mockGet.mockResolvedValueOnce({ data: mockData })

    await facultyApi.schedule('2nd')
    expect(mockGet).toHaveBeenCalledWith('/faculty/schedule', { params: { semester: '2nd' } })
  })
})

describe('facultyApi.scheduleWeekly', () => {
  it('calls GET /faculty/schedule/weekly', async () => {
    const mockData = { semester: '1st', weekly: {} }
    mockGet.mockResolvedValueOnce({ data: mockData })

    await facultyApi.scheduleWeekly('1st')
    expect(mockGet).toHaveBeenCalledWith('/faculty/schedule/weekly', { params: { semester: '1st' } })
  })
})

describe('facultyApi.classes', () => {
  it('calls GET /faculty/classes with semester', async () => {
    const mockData = { classes: [], stats: {}, semester: '1st', academic_year: null }
    mockGet.mockResolvedValueOnce({ data: mockData })

    await facultyApi.classes('1st')
    expect(mockGet).toHaveBeenCalledWith('/faculty/classes', { params: { semester: '1st' } })
  })
})

describe('facultyApi.getProfile', () => {
  it('calls GET /faculty/profile', async () => {
    const mockProfile = { id: 1, username: 'jdoe', email: 'jdoe@test.com', full_name: 'John Doe' }
    mockGet.mockResolvedValueOnce({ data: mockProfile })

    const result = await facultyApi.getProfile()
    expect(mockGet).toHaveBeenCalledWith('/faculty/profile')
    expect(result.username).toBe('jdoe')
  })
})

describe('facultyApi.updateProfile', () => {
  it('calls PUT /faculty/profile with data', async () => {
    mockPut.mockResolvedValueOnce({ data: { success: true, message: 'Updated' } })

    const result = await facultyApi.updateProfile({ first_name: 'Jane' })
    expect(mockPut).toHaveBeenCalledWith('/faculty/profile', { first_name: 'Jane' })
    expect(result.success).toBe(true)
  })
})

describe('facultyApi.getNotifications', () => {
  it('calls GET /faculty/notifications with limit and offset', async () => {
    mockGet.mockResolvedValueOnce({ data: { notifications: [], unread_count: 0 } })

    await facultyApi.getNotifications(10, 5)
    expect(mockGet).toHaveBeenCalledWith('/faculty/notifications', { params: { limit: 10, offset: 5 } })
  })
})

describe('facultyApi.markNotificationRead', () => {
  it('calls POST /faculty/notifications/:id/read', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })

    await facultyApi.markNotificationRead(42)
    expect(mockPost).toHaveBeenCalledWith('/faculty/notifications/42/read')
  })
})

describe('facultyApi.markAllNotificationsRead', () => {
  it('calls POST /faculty/notifications/read-all', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, updated: 5 } })

    const result = await facultyApi.markAllNotificationsRead()
    expect(mockPost).toHaveBeenCalledWith('/faculty/notifications/read-all')
    expect(result.updated).toBe(5)
  })
})

describe('facultyApi.deleteNotification', () => {
  it('calls DELETE /faculty/notifications/:id', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } })

    await facultyApi.deleteNotification(7)
    expect(mockDelete).toHaveBeenCalledWith('/faculty/notifications/7')
  })
})

describe('facultyApi PDF exports', () => {
  it('exportSchedulePdf triggers blob download', async () => {
    const mockBlobData = 'pdf-content'
    mockGet.mockResolvedValueOnce({ data: mockBlobData })

    const createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    const revokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL

    const mockClick = vi.fn()
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValueOnce({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement)

    await facultyApi.exportSchedulePdf('1st')

    expect(mockGet).toHaveBeenCalledWith('/faculty/schedule/export-pdf', {
      params: { semester: '1st' },
      responseType: 'blob',
    })
    expect(mockClick).toHaveBeenCalled()
    mockCreateElement.mockRestore()
  })
})
