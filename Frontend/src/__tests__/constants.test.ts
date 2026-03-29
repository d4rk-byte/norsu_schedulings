import { describe, it, expect } from 'vitest'
import { ROLES, ROLE_LABELS, ROLE_DASHBOARDS, SEMESTERS, DAY_PATTERNS, ROOM_TYPES, SCHEDULE_STATUSES, DEFAULT_PAGE_SIZE } from '@/lib/constants'

describe('Constants: ROLES', () => {
  it('defines ADMIN, DEPARTMENT_HEAD, FACULTY', () => {
    expect(ROLES.ADMIN).toBe(1)
    expect(ROLES.DEPARTMENT_HEAD).toBe(2)
    expect(ROLES.FACULTY).toBe(3)
  })
})

describe('Constants: ROLE_LABELS', () => {
  it('maps role numbers to display labels', () => {
    expect(ROLE_LABELS[1]).toBe('Administrator')
    expect(ROLE_LABELS[2]).toBe('Department Head')
    expect(ROLE_LABELS[3]).toBe('Faculty')
  })
})

describe('Constants: ROLE_DASHBOARDS', () => {
  it('maps role numbers to dashboard paths', () => {
    expect(ROLE_DASHBOARDS[1]).toBe('/admin/dashboard')
    expect(ROLE_DASHBOARDS[2]).toBe('/department-head/dashboard')
    expect(ROLE_DASHBOARDS[3]).toBe('/faculty/dashboard')
  })
})

describe('Constants: SEMESTERS', () => {
  it('has the correct semester values', () => {
    expect(SEMESTERS).toEqual(['1st', '2nd', 'Summer'])
  })
})

describe('Constants: DAY_PATTERNS', () => {
  it('contains M-W-F pattern', () => {
    const mwf = DAY_PATTERNS.find(p => p.value === 'M-W-F')
    expect(mwf).toBeDefined()
    expect(mwf?.label).toBe('Monday-Wednesday-Friday')
  })

  it('contains T-TH pattern', () => {
    const tth = DAY_PATTERNS.find(p => p.value === 'T-TH')
    expect(tth).toBeDefined()
    expect(tth?.label).toBe('Tuesday-Thursday')
  })
})

describe('Constants: ROOM_TYPES', () => {
  it('includes expected types', () => {
    expect(ROOM_TYPES).toContain('classroom')
    expect(ROOM_TYPES).toContain('laboratory')
    expect(ROOM_TYPES).toContain('auditorium')
    expect(ROOM_TYPES).toContain('office')
  })
})

describe('Constants: SCHEDULE_STATUSES', () => {
  it('includes active, inactive, draft', () => {
    expect(SCHEDULE_STATUSES).toContain('active')
    expect(SCHEDULE_STATUSES).toContain('inactive')
    expect(SCHEDULE_STATUSES).toContain('draft')
  })
})

describe('Constants: DEFAULT_PAGE_SIZE', () => {
  it('is 20', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20)
  })
})
